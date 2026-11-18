# Yaver — Gizlilik Politikası

**Yürürlük tarihi:** 18 Kasım 2026<br>
Bu metin, [İngilizce (English)](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/en.md) ve [Almanca (Deutsch)](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/de.md) sürümleriyle aynı içeriktedir.

> **Kısaca**
>
> - Yaver’in geliştiricisi sizin için sunucu çalıştırmaz ve uygulamaya girdiğiniz verilerin hiçbirini almaz. Yaver hesabı yoktur; reklam, analiz ve takip de yoktur.
> - Yaver’den yapmasını istediğiniz her şey yalnızca Yaver sunucunuza gider. Bu sunucuyu siz kendiniz çalıştırırsınız: kendi bilgisayarınızda ya da bir barındırma (hosting) hizmetinde. Görevleriniz, görüşme dökümleriniz ve raporlarınız orada saklanır.
> - Kendi hesaplarınızı bağlayana kadar sunucunuz aramaları yalnızca simüle eder ve hiçbir şey bir yapay zekâ hizmetine gitmez. Yapay zekâyla çalışan bir telefon hizmeti olan Retell AI’daki kendi hesabınızı bağlarsanız sunucunuz gerçek aramaları Retell üzerinden yapar. Kendi Anthropic anahtarınızı eklerseniz Anthropic’in yapay zekâsı Claude raporlarınızı yazar; mektuplarınız, mesajlarınız ve formlarınız üzerinde de çalışır. İkisi de verileri AB dışında, ağırlıklı olarak ABD’de işler. Verileriniz bu hizmetlere ilk kez gitmeden önce uygulama sizden izin ister. Bunun tek bir istisnası vardır; aşağıda açıklanmıştır.
> - Retell her gerçek aramayı kaydeder. Yaver’in aradığı ya da sizi arayan herkes, en başta bir yapay zekâyla konuştuğunu ve görüşmenin kaydedildiğini duyar. Ardından sunucunuz aramayı Retell’e sildirir; yazılı döküm sizin sunucunuzda kalır ([ayrıntılar](#retell-ai-gerçek-telefon-aramaları)).
> - Canlı çevirmen iPhone’unuzda çalışır; görüşme dökümlerinin çevirisi ve bir mektubun fotoğrafındaki metnin okunması da iPhone’unuzda yapılır. iPhone’unuz dili kendisi tanıyabiliyorsa konuşma tanıma da iPhone’da yapılır. Tanıyamıyorsa iOS sesi Apple’a gönderir.
> - Verilerinizi silmek için **Aramalarımı yanıtla**’yı kapatın, sunucunuzun `data` klasörünü silin, ardından uygulamayı silin ([nasıl](#veriler-ne-kadar-saklanır-nasıl-silinir)). Sorularınız için: [caanonurr@gmail.com](mailto:caanonurr@gmail.com).

## Verilerden kim sorumlu?

**Yaver’in geliştiricisi**, yani Yaver’in App Store sayfasında satıcı olarak adı geçen kişi. E-posta: [caanonurr@gmail.com](mailto:caanonurr@gmail.com)

Geliştirici, kullanıcılar için sunucu çalıştırmaz ve uygulamadan hiçbir kişisel veri almaz. Geliştiriciye yalnızca şunlar ulaşır:

- gönderdiğiniz e-postalar;
- iPhone’unuzun ayarlarında buna izin verirseniz Apple’dan gelen çökme raporları ve istatistikler;
- Yaver’in bir TestFlight sürümünü test ederseniz Apple’ın test kullanıcıları hakkında geliştiricilere gösterdikleri ([bkz. Apple](#apple-konuşma-tanıma-çeviri-çökme-raporları)).

Geliştirici yalnızca bu verilerden sorumludur (hukuki deyişle “veri sorumlusu”dur).

Geliştirici, Apple’ın uygulama incelemesi için aramaları yalnızca simüle eden bir demo sunucusu çalıştırır. Bu sunucunun adresini ve erişim anahtarını yalnızca Apple’ın inceleme ekibi alır. Bu sunucu yapay zekâ hizmetlerine hiçbir şey göndermez ve kullanıcılara yönelik değildir.

Geri kalan her şey sizin denetiminizdedir: iPhone’unuz, Yaver sunucunuz ve sunucunuza bağladığınız hesaplar.

## Uygulamanın iPhone’unuzda sakladıkları

- **Ayarlar:**
  - adınız (girerseniz) ve dilleriniz;
  - çevirmenin ayarları;
  - sunucunuzun adresi ve sunucunuza ulaşılabilen en fazla sekiz başka adres; böylece sunucunun adresi değiştiğinde uygulama onu yeniden bulabilir;
  - hangi raporları açtığınız;
  - hangi yapay zekâ hizmetlerine izin verdiğiniz.
- **iOS Anahtar Zinciri’nde** (iPhone’un parolalar için korumalı saklama alanı): sunucunuzun erişim anahtarı ve bir cihaz kimliği. Uygulama bu kimliği rastgele oluşturur ve bir kopyasını ayarlarında tutar. Bu kimlik, sunucunuza yalnızca hangi iPhone’un istekte bulunduğunu bildirir.
- **Hatırlatmalar:** İzin verirseniz iPhone’da bildirim olarak planlanır.
- **Çevirmenden hiçbir şey kaydedilmez.** Çevirmendeki konuşma yalnızca uygulamanın belleğinde tutulur; çevirmenden çıktığınızda ya da uygulamayı kapattığınızda silinir.

Uygulama bunları iPhone’unuzda yalnızca özellikleri için gerekli olduğundan saklar; bu nedenle sizden rıza istemez (Alman TDDDG § 25/2 no. 2). Reklam, istatistik ya da takip amacıyla hiçbir şey saklanmaz.

## Uygulama neyi kime gönderir?

### Kendi Yaver sunucunuz

Uygulama aşağıdakileri yalnızca Yaver sunucunuza gönderir:

- profiliniz: adınız, dilleriniz, Yaver’in aramalarınızı yanıtlayıp yanıtlamadığı ve arayanlar için notunuz;
- oluşturduğunuz her görev: Yaver’in ne yapması gerektiği, aranacak numara, diller, adınız, bir mektuptan veya formdan okunan metin, hatırlatma tarihi;
- her istekle birlikte cihaz kimliği; sunucunuz isterse erişim anahtarı da.

Sunucunuz bunların hepsini tek bir veritabanı dosyasında tutar; her aramanın dökümü, raporu ve yapılacakları ile arayanların numaraları da bu dosyadadır. Dosyadaki hiçbir şey kendiliğinden silinmez ([nasıl silinir](#veriler-ne-kadar-saklanır-nasıl-silinir)).

Sunucunuz aramaların ses kaydını saklamaz, yalnızca metni saklar. Gerçek aramaları ise Retell AI kaydeder: bkz. [Retell AI](#retell-ai-gerçek-telefon-aramaları).

Sunucunuzun penceresinde (barındırma hizmetinde: log kayıtlarında) her olay için bir satır görünür. Aramalarda bu satırda telefon numarası, yanıtlamayı açtığınızda da adınız yer alır. Erişim anahtarı da orada görünür: Onu kimseye göstermeyin. `LOG_REQUESTS=true` ayarıyla her isteğin IP adresi de görünür.

Uygulamanın sunucunuzu bulabilmesi için sunucunuz, Wi-Fi ağınızda kendini bilgisayarınızın adıyla duyurur (örneğin “Yaver on Ayşe’nin MacBook’u”). Aynı Wi-Fi ağındaki herkes bu adı görebilir; sunucunuz bu adı kendisine ulaşan herkese de bildirir. Duyuruyu durdurmak için `ADVERTISE=false` ayarını kullanın ya da bilgisayarınıza içinde adınızın geçmediği bir ad verin.

Evde uygulama sunucunuzla şifrelemesiz (http) iletişim kurabilir; bu yüzden yalnızca güvendiğiniz bir Wi-Fi ağı kullanın. İnternet üzerinden uygulama yalnızca şifreli bağlantı (https) kurar.

### Yapay zekâ hizmetleri: yalnızca kendi hesaplarınızla ve siz izin verdikten sonra (tek bir istisnayla)

Sunucunuz Retell AI’a veya Anthropic’e yalnızca sunucuyu oradaki **kendi** hesabınızla kurduysanız veri aktarır. Bu durumda bu şirketlerin şartları ve gizlilik politikaları (bağlantıları aşağıda) geçerli olur.

Verileriniz böyle bir hizmete ilk kez gitmeden önce uygulama, neyin nereye gittiğini anlatan “Verileriniz ve yapay zekâ hizmetleri” başlıklı bir pencere gösterir. **İzin ver**’e dokunana kadar hiçbir şey gönderilmez. **Şimdi değil**’e dokunursanız hiçbir şey gönderilmez. Henüz izin vermediğiniz bir hizmet kullanılacaksa uygulama şu durumlarda sorar: bir aramayı, mektubu, mesajı veya formu göndermeden önce, **Aramalarımı yanıtla**’yı açtığınızda ve **Gelen bir aramayı simüle et**’e dokunduğunuzda. Uygulama önce sunucunuzun hangi hizmetler için kurulduğuna bakar ve yalnızca bu hizmetleri sorar; bunu anlayamazsa ikisini birden sorar.

Uygulama yalnızca bir durumda sormaz:

- **Aramalarımı yanıtla** zaten açıkken sunucunuza bir Anthropic anahtarı eklerseniz yanıtlanan aramalarla ilgili notları o andan itibaren Claude yazar; uygulama bunun için size ayrıca sormaz. Bu ayarı sunucunuzda siz kendiniz yapmış olursunuz. İstemiyorsanız anahtarı eklemeden önce **Aramalarımı yanıtla**’yı kapatın. Uygulama, yanıtlamayı bir sonraki açışınızda sorar.

**İzninizi geri almak için:** Ayarlar → Hakkında → **İzni geri al** (bu düğme, bir hizmete izin verdikten sonra orada görünür). Sunucunuz gerçek aramalar yapıyorsa uygulama bu durumda **Aramalarımı yanıtla**’yı da kapatır. Bunun için sunucunuza ulaşılabilmesi gerekir. Ulaşılamıyorsa uygulama bir hata gösterir ve yanıtlama açık kalır: Sunucunuza ulaşılabildiği anda **Aramalarımı yanıtla**’yı kapatın. O zamana kadar yanıtlanan aramalar yine de sunucunuza alınır ve raporlanır; başlamış bir arama da sonuna kadar sürer. Uygulama, bir hizmet gerektiren bir sonraki görevden önce yeniden sorar. İzninizi geri almak, daha önce gönderilmiş olanları silmez ([nasıl silinir](#veriler-ne-kadar-saklanır-nasıl-silinir)).

#### Retell AI: gerçek telefon aramaları

ABD’de yerleşik bir şirket olan Retell AI, Inc., gerçek telefon aramalarını sunucunuz için ve sizin kendi Retell hesabınız üzerinden yapar ve yanıtlar.

- **Retell’e ne gider:** aranacak numara ve Retell telefon numaranız, isteğiniz, adınız, arama dili ve açılış cümlesi. Bu cümle, sizin adınıza bir yapay zekânın aradığını ve görüşmenin kaydedildiğini söyler. Sunucunuzun bir internet adresi varsa Retell, aramayı sunucunuza bildirebilmek için bu adresi de alır. Retell iki tarafın da sesini ve söylenen her şeyi işler. Bunun için telefon hatları, konuşma tanıma, yapay zekâ sesi ve yapay zekâ modeli konusunda başka şirketlerden yararlanır ([Retell’in listesi](https://trust.retellai.com/subprocessors)). Ardından Retell sunucunuza dökümü ve kendi kısa özetini gönderir.
- **Aramalarımı yanıtla’yı açarsanız:** Adınız, karşılama cümlesi, arayanlar için notunuz ve dilleriniz Retell hesabınıza kaydedilir; böylece Retell, bilgisayarınız kapalıyken de aramaları yanıtlayabilir. Bunlar, yanıtlamayı kapattıktan sonra da, siz Retell hesabınızda değiştirene ya da silene kadar orada kalır (aramaları yanıtlayan “Yaver — answers calls” adlı temsilciye, yani agent’a aittirler). Arayanların numaraları, sesleri ve mesajları da aynı şekilde işlenir ve kaydedilir.
- **Kayıt ve Retell’in kaydı ne kadar sakladığı:**
  - Retell her gerçek aramayı, hem sesini hem metnini kaydeder. Bu, Retell’in standart ayarıdır; Yaver bunu değiştirmez.
  - Bir arama biter bitmez sunucunuz, Retell’den aramayı, Retell’in o arama için sakladıklarıyla birlikte silmesini ister: Retell’in arama hakkındaki kendi analizi gelir gelmez, en geç de arama bittikten iki dakika sonra. Bu yalnızca sunucunuz çalışırken işler. Sunucunuz kapalıyken yanıtlanan bir arama, sunucunuz onu aldıktan sonra silinir. `RETELL_DELETE_AFTER_CALL` ayarını kapatmadığınız sürece sunucunuz bunu yapar.
  - Yedek önlem olarak standart kurulum (`npm run retell:setup`), aramaların Retell tarafından kendiliğinden silinmesini ayarlar: Yaver’in yaptığı aramalar bir gün sonra, Yaver’in yanıtladığı aramalar yedi gün sonra silinir. Yanıtlanan aramalar için süre yedi gündür; böylece bilgisayarınız kapalıyken bırakılan bir mesaj, bilgisayarınızı açtığınızda hâlâ orada olur.
  - Retell, silme işleminin “aramayı ve ilişkili verilerini” (“the call and its associated data”) kaldırdığını ve arama hakkında bazı temel bilgileri sakladığını belirtir.
- **Verilerin gittiği yer ve yapay zekâ eğitimi:** Retell, verileri ağırlıklı olarak ABD’de sakladığını ve işlediğini belirtir. AB’den gelen veriler için AB Standart Sözleşme Maddeleri (AB’nin, verilerin yurt dışına aktarılması için onayladığı sözleşme hükümleri) gibi güvencelerden söz eder; bunların bir kopyası support@retellai.com adresinden istenebilir. Retell, müşterilerine, yani size, bir veri işleme sözleşmesi sunar. Retell’in şartlarına göre Retell, arama verilerini kişileri tanımlayan bilgilerden arındırıp başka verilerle birleştirdikten sonra hizmetlerini ve yapay zekâ modellerini geliştirmek için kullanabilir. Yaver bunun yapılmadığından emin olamaz; Retell’in şartlarını kontrol edin (bağlantı aşağıda).
- [Retell’in gizlilik politikası](https://www.retellai.com/legal/privacy-policy) · [hizmet şartları](https://www.retellai.com/legal/terms-of-service)

#### Anthropic Claude: raporlar, mektuplar, mesajlar ve formlar

Anthropic’in yapay zekâsı Claude, arama raporlarınızı ve yanıtlanan aramalarla ilgili notları yazar, mektupları açıklar, mesajları yazar ve formları doldurur. Anthropic’in ticari şartlarına göre Avrupa Ekonomik Alanı’nda, İsviçre’de veya Birleşik Krallık’ta yaşıyorsanız sözleşme tarafınız Anthropic Ireland, Limited’dir; başka bir yerde, örneğin Türkiye’de yaşıyorsanız ABD’deki Anthropic PBC’dir. Her iki durumda da Anthropic, veri işleme eki çerçevesinde verileri yalnızca sizin adınıza ve talimatlarınız doğrultusunda işler (hukuki deyişle sizin “veri işleyen”inizdir).

- **Anthropic’e ne gider:** arama raporu için döküm, isteğiniz, diller ve adınız; Yaver’in yanıtladığı bir aramayla ilgili not için döküm, adınız ve dil; mektup, mesaj veya form için isteğiniz, belgenin metni ve diller. Mektuplarda çoğu zaman özel bilgiler bulunur; örneğin sağlığınız, mali durumunuz ya da oturma izniniz hakkında. Bir mektubu göndermeden önce Anthropic’in onu işlemesini kabul edip etmediğinize karar verin.
- **Saklama süresi:** Anthropic, sunucunuzun gönderdiklerini ve Claude’un yanıt olarak yazdıklarını normalde 30 gün içinde sildiğini belirtir. Bunları yalnızca iki durumda daha uzun saklar: yasa gerektirdiğinde ya da sistemleri bunları kullanım politikasının olası bir ihlali olarak işaretlediğinde (bu durumda en fazla iki yıl).
- **Verilerin gittiği yer ve yapay zekâ eğitimi:** Anthropic, verileri ABD’de sakladığını belirtir. Verileri AB Standart Sözleşme Maddelerine dayanarak başka ülkelerde de işleyebilir. Ticari şartlarına göre Anthropic bu verilerle yapay zekâ modellerini eğitemez.
- Sunucunuzda kendi Anthropic anahtarınız yoksa Anthropic’e hiçbir şey gitmez.
- [Anthropic’in gizlilik politikası](https://www.anthropic.com/legal/privacy) · [ticari şartlar](https://www.anthropic.com/legal/commercial-terms) · [veri işleme eki](https://www.anthropic.com/legal/data-processing-addendum) · [veri saklama](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)

### Apple: konuşma tanıma, çeviri, çökme raporları

- **Konuşma tanıma (çevirmende):** iPhone’unuz dili kendisi tanıyabiliyorsa ses iPhone’da kalır. Tanıyamıyorsa iOS sesi Apple’a gönderir ve çevirmen bunu size bildirir ([Apple’ın Siri, Dikte ve gizlilik hakkındaki açıklaması](https://www.apple.com/legal/privacy/data/en/ask-siri-dictation/)).
- **Çeviri** iPhone’da yapılır. iOS, dilleri Apple’dan indirmek için bir kez sorar. Apple, hangi dillerin çevrildiği gibi kullanım istatistikleri toplayabileceğini, ancak metnin kendisini toplamadığını belirtir.
- **Mektuplar ve formlar:** Uygulama metni iPhone’da okur ve fotoğrafı hiçbir zaman göndermez. Görevi gönderdiğinizde sunucunuza yalnızca metin gider.
- **Çökme raporları ve istatistikler:** Apple bunları geliştiriciye yalnızca siz izin verirseniz iletir: Ayarlar → Gizlilik ve Güvenlik → Analizler ve İyileştirmeler → Uygulama Geliştiricileriyle Paylaş. Bu ayarı orada istediğiniz zaman kapatabilirsiniz. Apple bunları geliştiriciye yalnızca sizi tanımlamayan bir biçimde verir. Bir çökme raporunda iPhone modeli, iOS ve uygulama sürümleri ve çökmenin teknik ayrıntıları bulunur. İstatistikler yalnızca toplamları gösterir.
- **TestFlight test sürümleri** (TestFlight, Apple’ın yeni sürümleri test etmeye yarayan uygulamasıdır): Apple çökme raporlarını geliştiriciye her zaman iletir; bunlarla birlikte iPhone modelinizi, test sürümünü ne sıklıkla kullandığınızı, gönderdiğiniz geri bildirimleri ve bunlara eklediğiniz ekran görüntülerini de iletir. Geliştirici sizi e-postayla davet ettiyse bunları adınız ve e-posta adresinizle birlikte görür. Herkese açık bir bağlantıyla katıldıysanız anonim kalırsınız.
- App Store’dan indirme işlemini Apple yürütür ([Apple’ın gizlilik politikası](https://www.apple.com/legal/privacy/)).

### Cloudflare: yalnızca sunucunuzu `npm run start:public` ile başlatırsanız

Bu komutla Cloudflare, sunucunuza bir internet adresi verir (ücretsiz bir “quick tunnel”, yani hızlı tünel). Bu adres üzerinden sunucunuz ile uygulama veya Retell arasında gidip gelen her şey Cloudflare’in ağından geçer: uygulamanın bu adresi kullanırken gönderdikleri (evden uzaktayken ya da bu adresi içeren kodu taradıktan sonra), Retell’in gönderdiği her şey ve sunucunuzun yanıtları. Erişim anahtarı, görevleriniz, dökümler ve raporlar da buna dâhildir. Bunlar için Cloudflare’in [kullanım şartları](https://www.cloudflare.com/website-terms/) ve [gizlilik politikası](https://www.cloudflare.com/privacypolicy/) geçerlidir. Cloudflare, Inc. bir ABD şirketidir. Cloudflare, AB-ABD Veri Gizliliği Çerçevesi (EU-U.S. Data Privacy Framework) kapsamında sertifikalı olduğunu belirtir; AB, bu çerçeve kapsamında sertifikalı ABD şirketlerine gönderilen verilerin yeterli düzeyde korunduğunu kabul eder. Sunucunuzu `npm start` ile ya da **Start Yaver.command** dosyasına çift tıklayarak başlatırsanız Cloudflare’den hiçbir şey geçmez.

### Barındırma hizmeti: yalnızca birini seçerseniz

Sunucunuzu kendi bilgisayarınız yerine bir barındırma hizmetinde çalıştırırsanız sunucunuzun veritabanı ve log kayıtları o şirkette saklanır. Bunlar için o şirketin şartları ve gizlilik politikası geçerli olur.

### Geri ara, Raporu paylaş ve web sayfaları

“Geri ara”, iPhone’un Telefon uygulamasını numarayla birlikte açar. “Raporu paylaş”, iOS’un paylaşma menüsünü açar; raporun nereye gideceğini siz seçersiniz. “Gizlilik politikası”, “Yardım ve iletişim” ve “Bu sonuçla ilgili bir sorun bildir”, web tarayıcınızda GitHub’daki sayfaları açar. Bu durumda GitHub (ABD), IP adresiniz gibi ziyaretinize ait verileri kendi [gizlilik bildirimine](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) göre işler. Geliştirici yalnızca sayfaların kaç kez görüntülendiğini görebilir, kimin görüntülediğini göremez.

### Üçüncü kişiler

Uygulamanın kendisi verilerinizi hiçbir üçüncü kişiyle paylaşmaz. Uygulamada analiz, reklam ya da başka bir üçüncü taraf kodu yoktur; geliştiricinin kullanıcı verisi alan bir iş ortağı veya bağlı şirketi de yoktur. Retell AI, Anthropic, Cloudflare ya da bir barındırma hizmeti verileri yalnızca kendi sunucunuzdan, yalnızca yukarıda anlatılan durumlarda ve yalnızca onları orada siz kurduğunuz için alır. Apple verileri yalnızca iOS üzerinden alır; GitHub ise yukarıda anlatıldığı gibi yalnızca sayfalarına yaptığınız ziyaretleri görür. Geliştiriciye yazdığınız e-postalar, geliştiricinin e-posta sağlayıcısı Google’da saklanır ([aşağıya bakın](#veriler-ne-kadar-saklanır-nasıl-silinir)). Bu şirketlerin her biri verileri, bu sayfada bağlantısı verilen kendi şartlarına göre korur. Geliştirici bu şartların bu politikada anlatılandan fazlasına izin verdiğini biliyorsa bu sayfa bunu belirtir; örneğin Retell’in, kişileri tanımlayan bilgilerden arındırılmış arama verilerini kullanabilmesi.

## iPhone’unuzdaki izinler

Hepsi isteğe bağlıdır. Birini reddederseniz yalnızca ona ihtiyaç duyan özellik çalışmaz. İzinleri istediğiniz zaman Ayarlar → Uygulamalar → Yaver bölümünden değiştirebilirsiniz.

| İzin | Ne için |
|---|---|
| Yerel ağ | Sunucunuzu Wi-Fi ağınızda bulmak ve onunla iletişim kurmak |
| Mikrofon, konuşma tanıma | Çevirmen |
| Kamera | Bir mektubun veya formun fotoğrafını çekmek |
| Bildirimler | Hatırlatmalar |

**Fotoğraflar:** İzin gerekmez. Yalnızca iPhone’unuz kamerasıyla belge tarayamıyorsa mektubun veya formun bir fotoğrafını iOS’un kendi fotoğraf seçicisinde seçersiniz; uygulama yalnızca o fotoğrafı alır.

## Aradığınız ve sizi arayan kişiler

Her gerçek aramanın başında yapay zekâ, sizin adınıza konuşan bir yapay zekâ asistanı olduğunu ve görüşmenin kaydedildiğini söyler. Yaver bir arama yaptığında adınızı da söyler; bu yüzden gerçek bir arama için adınız gerekir (Ayarlar → Siz). Sizin yerinize bir aramayı yanıtladığında ise adınızı girdiyseniz onu söyler.

Karşı taraftaki kişiyle ilgili olarak Yaver şunları işler:

- telefon numarasını;
- sesini: Retell sesi görüşme sırasında işler ve sunucunuz aramayı sildirene kadar kaydını tutar (bkz. [Retell AI](#retell-ai-gerçek-telefon-aramaları));
- söylediklerini: Bunlar sunucunuzda döküm olarak saklanır; sunucunuz raporları Claude’a yazdırıyorsa Anthropic’e de gönderilir.

Bu kişiler, kendileri hakkında neyin saklandığını öğrenmek ya da bu verilerin silinmesini sağlamak isterlerse size başvurmalıdır. Görüşmede adı geçen kişi sizsiniz ve dökümü saklayan Yaver sunucusunu siz çalıştırıyorsunuz. Yaver’in geliştiricisinde bu kişilere ait hiçbir veri yoktur. Yaver ile sunucunuzdaki tek bir aramayı silemezsiniz; yalnızca her şeyi birden silebilirsiniz ([nasıl](#veriler-ne-kadar-saklanır-nasıl-silinir)). Retell’de ise tek bir aramayı Retell hesabınızdan silebilirsiniz.

## Sizin sorumluluğunuz

Yaver’i ne için kullanırsanız kullanın, özel kullanım da dâhil, görüşmelerin kaydedilmesine ilişkin yasalara uymanız gerekir (Almanya’da Alman Ceza Kanunu § 201, Türkiye’de Türk Ceza Kanunu md. 133). Bu yüzden her gerçek arama, görüşmenin kaydedildiği söylenerek başlar.

Yaver’i yalnızca kendi özel işleriniz için kullanıyorsanız, örneğin kendiniz veya aileniz için doktorunuzun muayenehanesini ya da ev sahibinizi arıyorsanız, bu genellikle tamamen kişisel bir kullanımdır. Bu durumda karşı tarafın verilerini nasıl işlediğiniz konusunda AB Genel Veri Koruma Tüzüğü (GDPR) uygulanmaz (GDPR md. 2/2-c). Bu istisna dardır. Türkiye’de ise daha da dardır ([aşağıya bakın](#türkiyedeki-kullanıcılar-için-notlar-kvkk)).

Yaver’i işiniz, bir işletme, serbest meslek faaliyetiniz, bir dernek ya da başka kişiler için kullanıyorsanız bu aramalardan veri koruma hukuku bakımından siz sorumlusunuz: “veri sorumlusu” sizsiniz. Bu durumda:

- aramalar için bir hukuki dayanağınız olmalıdır;
- ilgili kişileri, verilerinin nasıl işlendiği konusunda aydınlatmalısınız. Açılış cümlesi yalnızca bir başlangıçtır; geri kalanını, sorduklarında, örneğin kendi aydınlatma metninizle bildirin;
- bağladığınız her hizmetle bir veri işleme sözleşmesi yapmalısınız (GDPR md. 28). Anthropic’in veri işleme eki, ticari şartlarının bir parçasıdır. Retell, kendi sözleşmesini çevrim içi imzalayabileceğinizi belirtir. Barındırma hizmetinizin şartlarını da kontrol edin;
- verilerin AB dışına aktarılmasına ilişkin kurallara uymalısınız (Türkiye’de: KVKK’nın yurt dışına aktarım kuralları).

## Veriler ne kadar saklanır, nasıl silinir?

- **iPhone’unuzda:** uygulamayı silene kadar (Yaver simgesine dokunup parmağınızı basılı tutun → Uygulamayı Kaldır → Uygulamayı Sil); iPhone’unuzun yedeklerinde (iCloud’da veya bilgisayarda) ise bu yedekler silinene kadar. iOS, uygulamayı sildikten sonra da erişim anahtarını ve cihaz kimliğini Anahtar Zinciri’nde tutabilir. Yaver’i yeniden yüklerseniz uygulama bunları yeniden kullanır; kendi sunucunuz olmadan bunlar hiçbir işe yaramaz. İndirdiğiniz çeviri dilleri iPhone’da kalır; bunları Ayarlar → Uygulamalar → Çeviri → İndirilen Diller bölümünden kaldırabilirsiniz. Uygulamayı silmeden önce **Aramalarımı yanıtla**’yı kapatın: Uygulamayı silmek, sunucunuzun veya Retell’in aramalarınızı yanıtlamasını durdurmaz.
- **Sunucunuzda:** siz kendiniz silene kadar. Uygulamada silme düğmesi yoktur ve Yaver tek tek aramaları silemez. Her şeyi silmek için:
  1. Uygulamada **Aramalarımı yanıtla**’yı kapatın; böylece Retell aramaları yanıtlamayı bırakır.
  2. Sunucunuzu durdurun: Penceresini kapatın (ya da pencerede Ctrl-C’ye basın). Barındırma hizmetindeyse sunucuyu orada durdurun.
  3. Yaver proje klasöründe (**Start Yaver.command** dosyasının bulunduğu klasör) `backend` klasörünü açın ve içindeki `data` klasörünü silin. Barındırma hizmetindeyse bunun yerine sunucunuza bağlı depolama alanını (volume) silin.
  4. Artık tüm görevler, dökümler ve raporlar silinmiştir; sunucunuzun oluşturduğu erişim anahtarı da. Sunucunuz yeniden başlatıldığında boş başlar. Yeni bir kod gösterirse uygulamayı yeniden bağlamak için bu kodu iPhone’un Kamera uygulamasıyla tarayın.
- **Retell’de:** Sunucunuz her aramayı biter bitmez sildirir; standart kurulumda Retell de aramaları bir veya yedi gün sonra kendiliğinden siler ([ayrıntılar](#retell-ai-gerçek-telefon-aramaları)). Retell hesabınızda aramaları, ayrıca adınızı, karşılama cümlesini ve notunuzu (yukarıya bakın) kendiniz de silebilirsiniz.
- **Anthropic’te:** Anthropic verileri kendi takvimine göre, normalde 30 gün içinde siler ([ayrıntılar](#anthropic-claude-raporlar-mektuplar-mesajlar-ve-formlar)).
- **Geliştiriciye gönderilen e-postalar:** Yalnızca size yanıt vermek için gerektiği sürece saklanır ve yasa daha uzun saklanmalarını gerektirmedikçe 12 ay içinde silinir. Daha erken silinmelerini isteyebilirsiniz. Bu, **Bu sonuçla ilgili bir sorun bildir**’e dokunduktan sonra gönderdiğiniz sorun bildirimleri için de geçerlidir. Yalnızca gerekli olanı gönderin: Parola veya erişim anahtarı göndermeyin; başka kişilerin bilgilerini yalnızca sorun bunlar olmadan anlaşılamıyorsa ekleyin. Geliştirici Gmail kullandığı için e-postaları Google da saklar ve işler; bunu ABD’de de yapabilir. Google, AB’nin yeterli koruma sağladığını kabul ettiği AB-ABD Veri Gizliliği Çerçevesi kapsamında sertifikalı olduğunu belirtir ([Google’ın gizlilik politikası](https://policies.google.com/privacy?hl=tr)).
- **Çökme raporları ve istatistikler:** Bunları Apple saklar ve ne kadar süre saklayacağına da Apple karar verir ([Apple’ın gizlilik politikası](https://www.apple.com/legal/privacy/)).

## Takip yok, reklam yok, satış yok

Uygulamada reklam, analiz, takip ve üçüncü taraf SDK’ları (başka şirketlerin yazılım geliştirme kitleri) yoktur. Hiçbir veri satılmaz; hiçbir şey sizi değerlendirmek ya da davranışlarınızı tahmin etmek için kullanılmaz (profil oluşturma yoktur). Yaver hakkınızda, sizin için hukuki sonuç doğuran ya da sizi benzer ölçüde ciddi biçimde etkileyen otomatik kararlar vermez (GDPR md. 22).

## Hukuki dayanaklar (GDPR)

| Ne | Hukuki dayanak |
|---|---|
| Geliştiriciye gönderilen e-postalar | GDPR md. 6/1-f: geliştiricinin size yanıt verme konusundaki meşru menfaati. Sorunuz uygulamanın kullanımıyla ilgiliyse: GDPR md. 6/1-b, uygulamayı size sunmak için. |
| Apple’dan gelen çökme raporları ve istatistikler (TestFlight’tan gelenler de) | Apple bunları geliştiriciye yalnızca sizi tanımlamayan bir biçimde verir (TestFlight için bkz. [Apple](#apple-konuşma-tanıma-çeviri-çökme-raporları)). Yine de kişisel veri sayıldıkları ölçüde: GDPR md. 6/1-f, geliştiricinin hataları bulup düzeltme konusundaki meşru menfaati. Apple’ın bunları paylaşıp paylaşmayacağını iOS’ta siz seçersiniz. |

Geliştirici, iPhone’unuzdaki ve sunucunuzdaki verileri ya da sunucunuzun Retell’e, Anthropic’e, Cloudflare’e veya bir barındırma hizmetine gönderdiklerini işlemez. Bu yüzden geliştiricinin bunlar için bir hukuki dayanağa ihtiyacı yoktur: Bunlar hakkında siz karar verirsiniz ([bkz. Sizin sorumluluğunuz](#sizin-sorumluluğunuz)). Uygulamanın, veriler bir yapay zekâ hizmetine gitmeden önce sizden izin istemesi Apple’ın bir kuralıdır ve sizin için bir güvencedir. Bu izin, aradığınız kişilerin açık rızası sayılmaz.

Hiçbir veriyi vermek zorunda değilsiniz. Sunucu olmadan yalnızca canlı çevirmen çalışır. Bir izni vermezseniz yalnızca o izne ihtiyaç duyan özellik çalışmaz. Adınız olmadan Yaver gerçek arama yapmaz. E-posta adresiniz olmadan geliştirici size yanıt veremez.

## Haklarınız

**Geliştiriciden neler isteyebilirsiniz?** Geliştiricide sizinle ilgili veri yalnızca ona e-posta yazdıysanız ya da Yaver’i TestFlight ile test ediyorsanız (Apple’ın test kullanıcıları hakkında gösterdikleri) bulunur. Bu veriler için şunları isteyebilirsiniz:

- geliştiricide sizinle ilgili hangi verilerin bulunduğunun bildirilmesini ve bunların bir kopyasını (GDPR md. 15);
- düzeltilmelerini (md. 16);
- silinmelerini (md. 17);
- işlenmelerinin kısıtlanmasını (md. 18);
- uygulanabildiği durumlarda, size yaygın bir dosya biçiminde verilmelerini (md. 20).

Bunun için [caanonurr@gmail.com](mailto:caanonurr@gmail.com) adresine yazın.

**İtiraz hakkınız.** Geliştiricinin e-postalarınızı veya çökme raporlarını meşru menfaatine dayanarak kullanmasına istediğiniz zaman itiraz edebilirsiniz (GDPR md. 21). [caanonurr@gmail.com](mailto:caanonurr@gmail.com) adresine yazın.

**Geri kalan her şey sizin elinizde.** Geliştiricinin iPhone’unuza, sunucunuza ya da Retell, Anthropic, Cloudflare veya bir barındırma hizmetindeki hesaplarınıza erişimi yoktur; bu yüzden oradaki hiçbir şeyi size gösteremez, düzeltemez ya da silemez. Bunu ya kendiniz yaparsınız ([nasıl](#veriler-ne-kadar-saklanır-nasıl-silinir)) ya da bu şirketlere başvurursunuz; gizlilik politikalarının bağlantıları yukarıdadır. Apple’ın çökme raporlarını durdurmak için: iPhone’unuzda Ayarlar → Gizlilik ve Güvenlik → Analizler ve İyileştirmeler → Uygulama Geliştiricileriyle Paylaş. Uygulamanın yapay zekâ hizmetleri için aldığı izni geri almak için: Yaver’de Ayarlar → Hakkında → İzni geri al.

**Şikâyet.** Bir veri koruma denetim makamına, özellikle yaşadığınız, çalıştığınız ya da ihlalin gerçekleştiğini düşündüğünüz AB ülkesindeki makama şikâyette bulunabilirsiniz (GDPR md. 77): [Almanya’daki denetim makamları](https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html) · [tüm AB ve Avrupa Ekonomik Alanı ülkelerindeki denetim makamları](https://www.edpb.europa.eu/about-edpb/our-members_en).

## Türkiye’deki kullanıcılar için notlar (KVKK)

6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında:

- **Geliştirici.** Geliştiriciye ulaşan veriler bakımından veri sorumlusu Yaver’in geliştiricisidir ([iletişim](#verilerden-kim-sorumlu)). Geliştirici uygulamadan hiçbir veri almaz.
  - E-postalarınız, siz yazdığınızda elektronik ortamda toplanır ve yalnızca size yanıt vermek için kullanılır. Hukuki sebep: geliştiricinin meşru menfaati (KVKK md. 5/2-f). E-postalar Google’da (Gmail) saklanır; Google bunları Türkiye dışında, örneğin ABD’de işleyebilir.
  - Apple’dan gelen çökme raporları ve istatistikler sizi tanımlamaz. Tanımladıkları durumda (TestFlight) hukuki sebep, hataları düzeltmeye yönelik meşru menfaattir (KVKK md. 5/2-f).
- **Siz.** Türkiye’de özel kullanım istisnası (KVKK md. 28/1-a) dardır. Yalnızca tamamen kendinizle veya aynı konutta yaşadığınız aile bireylerinizle ilgili faaliyetleri kapsar ve yalnızca veriler üçüncü kişilere verilmiyorsa geçerlidir. Sunucunuz arama verilerini Retell’e ve Anthropic’e aktardığı için Yaver’i özel amaçla kullansanız bile KVKK uygulanabilir. Uygulandığı durumda aramalarınız bakımından veri sorumlusu sizsiniz. Bu durumda aradığınız kişileri, verilerinin nasıl kullanıldığı konusunda aydınlatmanız gerekir (KVKK md. 10). Sunucunuz ABD’ye veri gönderdiği için (Retell, Anthropic ve kullanıyorsanız Cloudflare) KVKK’nın yurt dışına aktarım kurallarına da uymanız gerekir (KVKK md. 9).
- **Haklarınız (KVKK md. 11).** İlgili kişi olarak şu haklara sahipsiniz:
  - kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi isteme;
  - verilerin hangi amaçla işlendiğini ve bu amaca uygun kullanılıp kullanılmadığını öğrenme;
  - verilerin yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme;
  - eksik veya yanlış işlenmiş verilerin düzeltilmesini, verilerin silinmesini veya yok edilmesini ve bu işlemlerin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme;
  - verilerin yalnızca otomatik sistemlerle analiz edilmesi sonucunda aleyhinize bir sonuç çıkmasına itiraz etme;
  - verilerin kanuna aykırı işlenmesi nedeniyle zarara uğrarsanız zararın giderilmesini isteme.
- **Nasıl başvurursunuz?** Önce geliştiriciye, daha önce yazışırken kullandığınız e-posta adresinden e-posta gönderin. Geliştirici en geç 30 gün içinde yanıt verir (KVKK md. 13). Yanıttan memnun kalmazsanız ya da yanıt alamazsanız Kişisel Verileri Koruma Kuruluna ([kvkk.gov.tr](https://www.kvkk.gov.tr)) şikâyette bulunabilirsiniz: yanıtı öğrendiğiniz tarihten itibaren 30 gün içinde; yanıt gelmediyse başvurunuzdan itibaren 60 gün içinde (KVKK md. 14).

## Çocuklar

Yaver yetişkinlere yöneliktir. Geliştirici uygulamadan hiçbir veri almadığı için çocuklar hakkında da veri toplamaz.

## Bu politikadaki değişiklikler

Yaver’in verilerle yaptıkları değiştiğinde bu sayfa güncellenir ve en üstteki tarih değişir. Önceki sürümleri GitHub’da görebilirsiniz: Bu sayfayı orada açın ve **History**’ye tıklayın.

## İletişim

Yaver’in geliştiricisi: [caanonurr@gmail.com](mailto:caanonurr@gmail.com)<br>
Uygulamayla ilgili yardım: [Yardım ve iletişim](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/support.md#türkçe)
