/**
 * Landing imagery. Files live in `public/img/`.
 *
 * Dimensions are the intrinsic pixel size of each source file — `next/image`
 * needs them to reserve layout space, and it re-encodes to WebP/AVIF at the
 * requested breakpoint, so the heavy source PNGs never reach the browser.
 *
 * `public/img/unused/` holds four stock images that were supplied but not
 * wired in: three use a cyan/neon treatment that fights the navy + burnt-orange
 * palette, and one is a boardroom handshake — wrong audience for kirana
 * shopkeepers. They're kept, not deleted. `E-COMMERCE.jfif` joined them: a
 * 626px-wide dark neon render — too small to show sharp and off-palette.
 *
 * `public/img/assets/` PNGs carry alpha. The shopkeeper, dashboard and counter
 * kit are cutouts and sit on any background; the store photo's edges fade out
 * unevenly, so it must sit on navy, which that fade dissolves into.
 */

export interface Media {
    src: string;
    width: number;
    height: number;
    /** Alt text must describe the image; it is localised at the call site. */
    alt: Record<'en' | 'hi' | 'gu', string>;
}

export const MEDIA = {
    heroCutout: {
        src: '/img/assets/shopkeeper.png',
        width: 1143,
        height: 1376,
        alt: {
            en: 'A smiling shopkeeper in an apron pointing at a tablet that shows today’s sales and low-stock items.',
            hi: 'एप्रन पहने मुस्कुराता दुकानदार, टैबलेट की ओर इशारा करते हुए जिसमें आज की बिक्री और कम स्टॉक दिख रहा है।',
            gu: 'એપ્રન પહેરેલો હસતો દુકાનદાર, ટેબ્લેટ તરફ ઇશારો કરતો જેમાં આજનું વેચાણ અને ઓછો સ્ટોક દેખાય છે.',
        },
    },
    dashboard: {
        src: '/img/assets/dashboard.png',
        width: 1536,
        height: 1024,
        alt: {
            en: 'A tablet showing a shop dashboard: sales chart, top-selling products, recent orders, low-stock alerts and expenses.',
            hi: 'दुकान का डैशबोर्ड दिखाता टैबलेट: बिक्री चार्ट, सबसे ज़्यादा बिकने वाला माल, हाल के ऑर्डर, कम स्टॉक अलर्ट और खर्च।',
            gu: 'દુકાનનું ડેશબોર્ડ બતાવતું ટેબ્લેટ: વેચાણ ચાર્ટ, સૌથી વધુ વેચાતો માલ, તાજેતરના ઓર્ડર, ઓછા સ્ટોકની ચેતવણી અને ખર્ચ.',
        },
    },
    counterKit: {
        src: '/img/assets/wigets.png',
        width: 1536,
        height: 1024,
        alt: {
            en: 'Counter essentials laid out: a billing tablet, a thermal receipt printer, a barcode scanner and a UPI scan-and-pay stand.',
            hi: 'काउंटर का सामान: बिलिंग टैबलेट, थर्मल रसीद प्रिंटर, बारकोड स्कैनर और UPI स्कैन-एंड-पे स्टैंड।',
            gu: 'કાઉન્ટરનો સામાન: બિલિંગ ટેબ્લેટ, થર્મલ રસીદ પ્રિન્ટર, બારકોડ સ્કેનર અને UPI સ્કેન-એન્ડ-પે સ્ટેન્ડ.',
        },
    },
    storeCounter: {
        src: '/img/assets/store.png',
        width: 1536,
        height: 1024,
        alt: {
            en: 'A tidy neighbourhood shop counter with a billing screen and receipt printer, stocked shelves behind.',
            hi: 'साफ़-सुथरा मोहल्ले की दुकान का काउंटर, बिलिंग स्क्रीन और रसीद प्रिंटर के साथ, पीछे भरी हुई रैक।',
            gu: 'સ્વચ્છ મહોલ્લાની દુકાનનું કાઉન્ટર, બિલિંગ સ્ક્રીન અને રસીદ પ્રિન્ટર સાથે, પાછળ ભરેલી રેક.',
        },
    },
    heroShopkeeper: {
        src: '/img/shopkeeper-phone-hero.png',
        width: 1536,
        height: 1024,
        alt: {
            en: 'A shopkeeper smiling at his phone behind the counter of a well-stocked kirana store.',
            hi: 'एक दुकानदार अपनी दुकान के काउंटर पर फ़ोन देखकर मुस्कुराते हुए।',
            gu: 'એક દુકાનદાર પોતાની દુકાનના કાઉન્ટર પર ફોન જોઈને હસતાં.',
        },
    },
    paperLedger: {
        src: '/img/paper-ledger.png',
        width: 1200,
        height: 800,
        alt: {
            en: 'A hand writing entries in a paper bahi-khata beside a calculator.',
            hi: 'कैलकुलेटर के पास कागज़ी बही-खाते में हिसाब लिखता हुआ हाथ।',
            gu: 'કેલ્ક્યુલેટર પાસે કાગળના ચોપડામાં હિસાબ લખતો હાથ.',
        },
    },
    posPrinter: {
        src: '/img/pos-printer-phone.png',
        width: 1200,
        height: 800,
        alt: {
            en: 'A phone and a thermal bill printer on a shop counter.',
            hi: 'दुकान के काउंटर पर फ़ोन और बिल प्रिंटर।',
            gu: 'દુકાનના કાઉન્ટર પર ફોન અને બિલ પ્રિન્ટર.',
        },
    },
    warehouse: {
        src: '/img/warehouse-inventory.png',
        width: 1200,
        height: 800,
        alt: {
            en: 'A wholesaler checking stock on a tablet between warehouse racks.',
            hi: 'गोदाम की रैक के बीच टैबलेट पर स्टॉक जाँचता थोक विक्रेता।',
            gu: 'ગોદામની રેક વચ્ચે ટેબ્લેટ પર સ્ટોક તપાસતો જથ્થાબંધ વેપારી.',
        },
    },
    phoneDashboard: {
        src: '/img/phone-dashboard.png',
        width: 1200,
        height: 800,
        alt: {
            en: 'A hand holding a phone showing a business dashboard with a sales chart.',
            hi: 'हाथ में फ़ोन, जिसमें बिक्री का चार्ट दिख रहा है।',
            gu: 'હાથમાં ફોન, જેમાં વેચાણનો ચાર્ટ દેખાય છે.',
        },
    },
    phoneLedger: {
        src: '/img/phone-ledger.png',
        width: 1200,
        height: 800,
        alt: {
            en: 'A hand holding a phone showing a customer list with amounts.',
            hi: 'हाथ में फ़ोन, जिसमें ग्राहकों की सूची और रकम दिख रही है।',
            gu: 'હાથમાં ફોન, જેમાં ગ્રાહકોની યાદી અને રકમ દેખાય છે.',
        },
    },
    dispatchTruck: {
        src: '/img/dispatch-truck.png',
        width: 1200,
        height: 800,
        alt: {
            en: 'A loaded delivery truck leaving a warehouse at sunrise.',
            hi: 'सुबह गोदाम से निकलता माल से भरा डिलीवरी ट्रक।',
            gu: 'સવારે ગોદામથી નીકળતી માલ ભરેલી ડિલિવરી ટ્રક.',
        },
    },
    packedInventory: {
        src: '/img/packed-inventory.png',
        width: 1200,
        height: 800,
        alt: {
            en: 'Cartons packed with grocery stock, ready for dispatch.',
            hi: 'किराने के सामान से भरे कार्टन, भेजने के लिए तैयार।',
            gu: 'કરિયાણાના સામાનથી ભરેલા ખોખાં, મોકલવા તૈયાર.',
        },
    },
    kiranaStore: {
        src: '/img/kirana-store.jpg',
        width: 464,
        height: 825,
        alt: {
            en: 'A shopkeeper working at the counter of a small kirana store.',
            hi: 'छोटी किराना दुकान के काउंटर पर काम करता दुकानदार।',
            gu: 'નાની કરિયાણાની દુકાનના કાઉન્ટર પર કામ કરતો દુકાનદાર.',
        },
    },
    byculla: {
        src: '/img/byculla-shop.jpg',
        width: 736,
        height: 1107,
        alt: {
            en: 'A trader sitting among sacks of grain in a neighbourhood shop.',
            hi: 'मोहल्ले की दुकान में अनाज की बोरियों के बीच बैठा व्यापारी।',
            gu: 'મહોલ્લાની દુકાનમાં અનાજની ગુણો વચ્ચે બેઠેલો વેપારી.',
        },
    },
} satisfies Record<string, Media>;
