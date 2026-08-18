import CoreGraphics
import Foundation

/// Turns a photo or drawing into a knittable colourwork chart.
enum ImageChartConverter {

    struct Options {
        /// How many stitches wide the finished chart should be.
        var stitches: Int = 40
        /// How many yarn colours to reduce the image to.
        var colourCount: Int = 4
        var gauge: Gauge
        var working: ChartWorking = .flat
        var yarnWeight: YarnWeight = .light
        /// If non-empty, every chart colour snaps to the closest yarn here.
        var stash: [Yarn] = []
        /// Keeps small details from disappearing into the nearest flat colour.
        var dither: Bool = false

        init(
            stitches: Int = 40,
            colourCount: Int = 4,
            gauge: Gauge,
            working: ChartWorking = .flat,
            yarnWeight: YarnWeight = .light,
            stash: [Yarn] = [],
            dither: Bool = false
        ) {
            self.stitches = max(2, min(300, stitches))
            self.colourCount = max(2, min(12, colourCount))
            self.gauge = gauge
            self.working = working
            self.yarnWeight = yarnWeight
            self.stash = stash
            self.dither = dither
        }
    }

    /// Rows needed so the knitted chart keeps the image's proportions.
    ///
    /// A knit stitch is wider than it is tall, so a square image needs more
    /// rows than stitches. Sampling on a square grid is why so many
    /// image-to-chart tools produce squashed results.
    static func rowCount(forStitches stitches: Int, imageSize: CGSize, gauge: Gauge) -> Int {
        guard imageSize.width > 0, imageSize.height > 0 else { return stitches }
        let imageAspect = Double(imageSize.height / imageSize.width)
        let finishedWidth = Double(stitches) * gauge.stitchWidth
        let finishedHeight = finishedWidth * imageAspect
        return max(1, Int((finishedHeight / gauge.rowHeight).rounded()))
    }

    static func convert(image: PlatformImage, options: Options) -> ColourChart? {
        let width = options.stitches
        let height = rowCount(forStitches: width, imageSize: image.knitPixelSize, gauge: options.gauge)
        guard width > 0, height > 0 else { return nil }

        guard var samples = pixels(from: image, width: width, height: height) else { return nil }

        // Reduce to the requested number of colours.
        var centroids = medianCut(samples, into: options.colourCount)
        centroids = refine(centroids: centroids, samples: samples, iterations: 12)

        if options.dither {
            samples = floydSteinberg(samples, width: width, height: height, palette: centroids)
        }

        var indices = samples.map { nearestIndex(to: $0, in: centroids) }

        // Order the palette by how much of the chart uses it, so index 0 is the
        // main colour — that is what a knitter expects the legend to say.
        var counts = Array(repeating: 0, count: centroids.count)
        for index in indices { counts[index] += 1 }
        let order = counts.enumerated().sorted { $0.element > $1.element }.map(\.offset)
        var remap = Array(repeating: 0, count: centroids.count)
        for (newIndex, oldIndex) in order.enumerated() { remap[oldIndex] = newIndex }
        indices = indices.map { remap[$0] }
        let sortedCentroids = order.map { centroids[$0] }

        // The pixel buffer runs top-down; chart row 0 is the bottom row.
        var cells = Array(repeating: 0, count: width * height)
        for y in 0 ..< height {
            let source = (height - 1 - y) * width
            for x in 0 ..< width {
                cells[y * width + x] = indices[source + x]
            }
        }

        let palette = sortedCentroids.enumerated().map { index, colour -> Yarn in
            if !options.stash.isEmpty, let match = closestYarn(to: colour, in: options.stash) {
                return match
            }
            return Yarn(
                name: index == 0 ? "Main colour" : "Contrast \(ColourAllocation.letter(index))",
                colourName: colour.hex,
                hex: colour.hex,
                weight: options.yarnWeight)
        }

        return ColourChart(
            name: "Imported chart",
            width: width,
            height: height,
            cells: cells,
            palette: palette,
            working: options.working,
            notes: "Generated from an image at \(width) sts × \(height) rows, "
                + "\(options.colourCount) colours.")
    }

    // MARK: - Pixels

    struct RGB: Equatable {
        var r: Double
        var g: Double
        var b: Double

        var hex: String {
            let clamp = { (value: Double) -> Int in max(0, min(255, Int((value * 255).rounded()))) }
            return String(format: "%02X%02X%02X", clamp(r), clamp(g), clamp(b))
        }
    }

    /// Draws the image down to the grid size and reads the averaged pixels.
    /// Core Graphics does the box-averaging for us at high interpolation
    /// quality, which is exactly the sampling a chart wants.
    static func pixels(from image: PlatformImage, width: Int, height: Int) -> [RGB]? {
        guard let cgImage = image.knitCGImage else { return nil }
        return pixels(from: cgImage, width: width, height: height)
    }

    static func pixels(from cgImage: CGImage, width: Int, height: Int) -> [RGB]? {
        guard width > 0, height > 0 else { return nil }
        let bytesPerPixel = 4
        let bytesPerRow = bytesPerPixel * width
        var data = [UInt8](repeating: 0, count: width * height * bytesPerPixel)

        let drew = data.withUnsafeMutableBytes { raw -> Bool in
            guard let base = raw.baseAddress,
                  let context = CGContext(
                    data: base,
                    width: width,
                    height: height,
                    bitsPerComponent: 8,
                    bytesPerRow: bytesPerRow,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
            else { return false }

            context.interpolationQuality = .high
            // Transparent images would otherwise sample as black.
            context.setFillColor(red: 1, green: 1, blue: 1, alpha: 1)
            let rect = CGRect(x: 0, y: 0, width: width, height: height)
            context.fill(rect)
            context.draw(cgImage, in: rect)
            return true
        }
        guard drew else { return nil }

        var result: [RGB] = []
        result.reserveCapacity(width * height)
        for index in stride(from: 0, to: data.count, by: bytesPerPixel) {
            result.append(RGB(
                r: Double(data[index]) / 255,
                g: Double(data[index + 1]) / 255,
                b: Double(data[index + 2]) / 255))
        }
        return result
    }

    // MARK: - Colour reduction

    /// Perceptual-ish distance. Green dominates human brightness perception,
    /// so weighting the channels beats plain Euclidean RGB.
    static func distance(_ a: RGB, _ b: RGB) -> Double {
        let dr = (a.r - b.r) * 0.30
        let dg = (a.g - b.g) * 0.59
        let db = (a.b - b.b) * 0.11
        return dr * dr + dg * dg + db * db
    }

    static func nearestIndex(to colour: RGB, in palette: [RGB]) -> Int {
        guard !palette.isEmpty else { return 0 }
        var best = 0
        var bestDistance = Double.greatestFiniteMagnitude
        for (index, candidate) in palette.enumerated() {
            let d = distance(colour, candidate)
            if d < bestDistance {
                bestDistance = d
                best = index
            }
        }
        return best
    }

    /// Median cut: repeatedly split the colour box with the widest spread.
    static func medianCut(_ samples: [RGB], into count: Int) -> [RGB] {
        guard !samples.isEmpty else { return [RGB(r: 0, g: 0, b: 0)] }
        var buckets: [[RGB]] = [samples]

        while buckets.count < count {
            // Only split buckets that actually contain a range of colours —
            // otherwise a flat image would yield several identical palette
            // entries and claim to need four yarns for one colour.
            guard let target = buckets.enumerated()
                .filter({ $0.element.count > 1 && spread($0.element) > 0 })
                .max(by: { spread($0.element) < spread($1.element) })
            else { break }

            var bucket = buckets[target.offset]
            let axis = widestAxis(bucket)
            bucket.sort { component($0, axis) < component($1, axis) }
            let middle = bucket.count / 2
            guard middle > 0, middle < bucket.count else { break }

            buckets.remove(at: target.offset)
            buckets.append(Array(bucket[..<middle]))
            buckets.append(Array(bucket[middle...]))
        }

        return buckets.compactMap(average)
    }

    static func component(_ colour: RGB, _ axis: Int) -> Double {
        axis == 0 ? colour.r : (axis == 1 ? colour.g : colour.b)
    }

    static func widestAxis(_ bucket: [RGB]) -> Int {
        var widest = 0
        var widestRange = -1.0
        for axis in 0 ... 2 {
            let values = bucket.map { component($0, axis) }
            let range = (values.max() ?? 0) - (values.min() ?? 0)
            if range > widestRange {
                widestRange = range
                widest = axis
            }
        }
        return widest
    }

    static func spread(_ bucket: [RGB]) -> Double {
        guard !bucket.isEmpty else { return 0 }
        var total = 0.0
        for axis in 0 ... 2 {
            let values = bucket.map { component($0, axis) }
            total += (values.max() ?? 0) - (values.min() ?? 0)
        }
        // Weight by size so a big flat area does not get split before a small
        // but wildly varied one.
        return total * Double(bucket.count)
    }

    static func average(_ bucket: [RGB]) -> RGB? {
        guard !bucket.isEmpty else { return nil }
        let count = Double(bucket.count)
        return RGB(
            r: bucket.reduce(0) { $0 + $1.r } / count,
            g: bucket.reduce(0) { $0 + $1.g } / count,
            b: bucket.reduce(0) { $0 + $1.b } / count)
    }

    /// Lloyd's algorithm — nudges the median-cut seeds to better centres.
    static func refine(centroids: [RGB], samples: [RGB], iterations: Int) -> [RGB] {
        guard !centroids.isEmpty, !samples.isEmpty else { return centroids }
        var current = centroids

        for _ in 0 ..< iterations {
            var buckets = Array(repeating: [RGB](), count: current.count)
            for sample in samples {
                buckets[nearestIndex(to: sample, in: current)].append(sample)
            }
            var moved = false
            for (index, bucket) in buckets.enumerated() {
                guard let mean = average(bucket) else { continue }
                if mean != current[index] {
                    current[index] = mean
                    moved = true
                }
            }
            if !moved { break }
        }
        return current
    }

    /// Floyd–Steinberg error diffusion, so gradients survive the reduction.
    static func floydSteinberg(
        _ samples: [RGB], width: Int, height: Int, palette: [RGB]
    ) -> [RGB] {
        var buffer = samples
        func add(_ index: Int, _ error: RGB, _ factor: Double) {
            guard index >= 0, index < buffer.count else { return }
            buffer[index].r += error.r * factor
            buffer[index].g += error.g * factor
            buffer[index].b += error.b * factor
        }

        for y in 0 ..< height {
            for x in 0 ..< width {
                let index = y * width + x
                let old = buffer[index]
                let new = palette[nearestIndex(to: old, in: palette)]
                buffer[index] = new
                let error = RGB(r: old.r - new.r, g: old.g - new.g, b: old.b - new.b)

                if x + 1 < width { add(index + 1, error, 7.0 / 16) }
                if y + 1 < height {
                    if x > 0 { add(index + width - 1, error, 3.0 / 16) }
                    add(index + width, error, 5.0 / 16)
                    if x + 1 < width { add(index + width + 1, error, 1.0 / 16) }
                }
            }
        }
        return buffer
    }

    static func closestYarn(to colour: RGB, in stash: [Yarn]) -> Yarn? {
        stash.min { first, second in
            let a = first.rgb
            let b = second.rgb
            return distance(colour, RGB(r: a.red, g: a.green, b: a.blue))
                < distance(colour, RGB(r: b.red, g: b.green, b: b.blue))
        }
    }
}
