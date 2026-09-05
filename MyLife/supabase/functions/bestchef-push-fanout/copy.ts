/**
 * BestChef push copy: server-side localized render for flagship notification
 * kinds (audit H13). GENERATED-STYLE but hand-committed: the per-locale strings
 * are lifted verbatim from the client i18n catalogs
 * (apps/bestchef/app/(root)/i18n/catalogs/*.ts) so push wording matches what the
 * user sees in-app. Keep this map in sync with those catalogs when the flagship
 * strings change. Covers all 21 BestChef locales; unknown locales fall back to
 * 'en'. Any non-flagship kind falls back to a localized generic title/body.
 *
 * The map is intentionally MINIMAL: only rank_up, rank_milestone,
 * moderation_decision, and appeal_resolved render bespoke copy. Moderation
 * pushes state the decision and that an appeal may be available; the full DSA
 * statement of reasons (reason category, appeal link) lives in-app, where the
 * push deep-links.
 */

export const PUSH_LOCALES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt-BR',
  'pt-PT',
  'nl',
  'sv',
  'pl',
  'tr',
  'id',
  'vi',
  'hi',
  'bn',
  'ta',
  'te',
  'th',
  'ja',
  'ko',
  'zh-Hans',
  'zh-Hant',
  'ar',
  'he',
] as const;

export type PushLocale = (typeof PUSH_LOCALES)[number];

export const DEFAULT_PUSH_LOCALE: PushLocale = 'en';

interface FlagshipStrings {
  rankUpTitle: string;
  rankMilestoneTitle: string;
  deltaOne: string;
  deltaMany: string;
  modRemoved: string;
  modHidden: string;
  modRejected: string;
  modOther: string;
  canAppeal: string;
  appealApproved: string;
  appealReviewed: string;
  appealRestored: string;
  appealStands: string;
  genericBody: string;
}

const STRINGS: Record<PushLocale, FlagshipStrings> = {
  'en': {
    rankUpTitle: 'You moved up to #{rank}',
    rankMilestoneTitle: 'You climbed to #{rank}!',
    deltaOne: 'Up {delta} rank this week',
    deltaMany: 'Up {delta} ranks this week',
    modRemoved: 'Your content was removed',
    modHidden: 'Your content was hidden',
    modRejected: 'Your content was not approved',
    modOther: 'A decision was made about your content',
    canAppeal: 'You can appeal this decision.',
    appealApproved: 'Your appeal was approved',
    appealReviewed: 'Your appeal was reviewed',
    appealRestored: 'We restored your content after review.',
    appealStands: 'After review, the original decision stands.',
    genericBody: 'You have a new notification',
  },
  'es': {
    rankUpTitle: 'Subiste al puesto #{rank}',
    rankMilestoneTitle: '¡Escalaste al puesto #{rank}!',
    deltaOne: 'Subiste {delta} puesto esta semana',
    deltaMany: 'Subiste {delta} puestos esta semana',
    modRemoved: 'Tu contenido fue eliminado',
    modHidden: 'Tu contenido fue ocultado',
    modRejected: 'Tu contenido no fue aprobado',
    modOther: 'Se tomó una decisión sobre tu contenido',
    canAppeal: 'Puedes apelar esta decisión.',
    appealApproved: 'Tu apelación fue aprobada',
    appealReviewed: 'Tu apelación fue revisada',
    appealRestored: 'Restauramos tu contenido tras la revisión.',
    appealStands: 'Tras la revisión, se mantiene la decisión original.',
    genericBody: 'Tienes una nueva notificación',
  },
  'fr': {
    rankUpTitle: 'Tu es monté au rang #{rank}',
    rankMilestoneTitle: 'Tu as atteint le rang #{rank} !',
    deltaOne: 'Tu gagnes {delta} place cette semaine',
    deltaMany: 'Tu gagnes {delta} places cette semaine',
    modRemoved: 'Votre contenu a été supprimé',
    modHidden: 'Votre contenu a été masqué',
    modRejected: 'Votre contenu n\'a pas été approuvé',
    modOther: 'Une décision a été prise concernant votre contenu',
    canAppeal: 'Vous pouvez contester cette décision.',
    appealApproved: 'Votre recours a été accepté',
    appealReviewed: 'Votre recours a été examiné',
    appealRestored: 'Nous avons rétabli votre contenu après examen.',
    appealStands: 'Après examen, la décision initiale est maintenue.',
    genericBody: 'Vous avez une nouvelle notification',
  },
  'de': {
    rankUpTitle: 'Du bist auf Platz #{rank} aufgestiegen',
    rankMilestoneTitle: 'Du hast Platz #{rank} erreicht!',
    deltaOne: '{delta} Platz besser als letzte Woche',
    deltaMany: '{delta} Plätze besser als letzte Woche',
    modRemoved: 'Dein Inhalt wurde entfernt',
    modHidden: 'Dein Inhalt wurde ausgeblendet',
    modRejected: 'Dein Inhalt wurde nicht freigegeben',
    modOther: 'Über deinen Inhalt wurde entschieden',
    canAppeal: 'Du kannst gegen diese Entscheidung Einspruch einlegen.',
    appealApproved: 'Dein Einspruch wurde bestätigt',
    appealReviewed: 'Dein Einspruch wurde geprüft',
    appealRestored: 'Wir haben deinen Inhalt nach der Prüfung wiederhergestellt.',
    appealStands: 'Nach der Prüfung bleibt die ursprüngliche Entscheidung bestehen.',
    genericBody: 'Du hast eine neue Benachrichtigung',
  },
  'it': {
    rankUpTitle: 'Sei salito al #{rank}',
    rankMilestoneTitle: 'Hai raggiunto il #{rank}!',
    deltaOne: 'Su di {delta} posizione questa settimana',
    deltaMany: 'Su di {delta} posizioni questa settimana',
    modRemoved: 'I tuoi contenuti sono stati rimossi',
    modHidden: 'I tuoi contenuti sono stati nascosti',
    modRejected: 'I tuoi contenuti non sono stati approvati',
    modOther: 'È stata presa una decisione sui tuoi contenuti',
    canAppeal: 'Puoi contestare questa decisione.',
    appealApproved: 'Il tuo ricorso è stato accolto',
    appealReviewed: 'Il tuo ricorso è stato esaminato',
    appealRestored: 'Abbiamo ripristinato i tuoi contenuti dopo la revisione.',
    appealStands: 'Dopo la revisione, la decisione originale resta valida.',
    genericBody: 'Hai una nuova notifica',
  },
  'pt-BR': {
    rankUpTitle: 'Você subiu para o #{rank}',
    rankMilestoneTitle: 'Você chegou ao #{rank}!',
    deltaOne: 'Subiu {delta} posição esta semana',
    deltaMany: 'Subiu {delta} posições esta semana',
    modRemoved: 'Seu conteúdo foi removido',
    modHidden: 'Seu conteúdo foi ocultado',
    modRejected: 'Seu conteúdo não foi aprovado',
    modOther: 'Uma decisão foi tomada sobre seu conteúdo',
    canAppeal: 'Você pode recorrer desta decisão.',
    appealApproved: 'Seu recurso foi aprovado',
    appealReviewed: 'Seu recurso foi analisado',
    appealRestored: 'Restauramos seu conteúdo após a análise.',
    appealStands: 'Após a análise, a decisão original é mantida.',
    genericBody: 'Você tem uma nova notificação',
  },
  'pt-PT': {
    rankUpTitle: 'Subiu para o #{rank}',
    rankMilestoneTitle: 'Chegou ao #{rank}!',
    deltaOne: 'Subiu {delta} posição esta semana',
    deltaMany: 'Subiu {delta} posições esta semana',
    modRemoved: 'O seu conteúdo foi removido',
    modHidden: 'O seu conteúdo foi ocultado',
    modRejected: 'O seu conteúdo não foi aprovado',
    modOther: 'Foi tomada uma decisão sobre o seu conteúdo',
    canAppeal: 'Pode contestar esta decisão.',
    appealApproved: 'O seu recurso foi aprovado',
    appealReviewed: 'O seu recurso foi analisado',
    appealRestored: 'Repusemos o seu conteúdo após a análise.',
    appealStands: 'Após a análise, a decisão original mantém-se.',
    genericBody: 'Tem uma nova notificação',
  },
  'nl': {
    rankUpTitle: 'Je bent gestegen naar #{rank}',
    rankMilestoneTitle: 'Je hebt #{rank} bereikt!',
    deltaOne: '{delta} plek omhoog deze week',
    deltaMany: '{delta} plekken omhoog deze week',
    modRemoved: 'Je content is verwijderd',
    modHidden: 'Je content is verborgen',
    modRejected: 'Je content is niet goedgekeurd',
    modOther: 'Er is een beslissing genomen over je content',
    canAppeal: 'Je kunt bezwaar maken tegen deze beslissing.',
    appealApproved: 'Je bezwaar is toegewezen',
    appealReviewed: 'Je bezwaar is beoordeeld',
    appealRestored: 'We hebben je content na beoordeling hersteld.',
    appealStands: 'Na beoordeling blijft de oorspronkelijke beslissing van kracht.',
    genericBody: 'Je hebt een nieuwe melding',
  },
  'sv': {
    rankUpTitle: 'Du klättrade till #{rank}',
    rankMilestoneTitle: 'Du nådde #{rank}!',
    deltaOne: 'Upp {delta} plats denna vecka',
    deltaMany: 'Upp {delta} platser denna vecka',
    modRemoved: 'Ditt innehåll togs bort',
    modHidden: 'Ditt innehåll dolts',
    modRejected: 'Ditt innehåll godkändes inte',
    modOther: 'Ett beslut fattades om ditt innehåll',
    canAppeal: 'Du kan överklaga detta beslut.',
    appealApproved: 'Ditt överklagande godkändes',
    appealReviewed: 'Ditt överklagande har granskats',
    appealRestored: 'Vi återställde ditt innehåll efter granskning.',
    appealStands: 'Efter granskning kvarstår det ursprungliga beslutet.',
    genericBody: 'Du har en ny avisering',
  },
  'pl': {
    rankUpTitle: 'Awansowałeś na #{rank}. miejsce',
    rankMilestoneTitle: 'Dotarłeś na #{rank}. miejsce!',
    deltaOne: 'W górę o {delta} miejsce w tym tygodniu',
    deltaMany: 'W górę o {delta} miejsc w tym tygodniu',
    modRemoved: 'Twoja treść została usunięta',
    modHidden: 'Twoja treść została ukryta',
    modRejected: 'Twoja treść nie została zatwierdzona',
    modOther: 'Podjęto decyzję dotyczącą Twojej treści',
    canAppeal: 'Możesz odwołać się od tej decyzji.',
    appealApproved: 'Twoje odwołanie zostało uwzględnione',
    appealReviewed: 'Twoje odwołanie zostało rozpatrzone',
    appealRestored: 'Po weryfikacji przywróciliśmy Twoją treść.',
    appealStands: 'Po weryfikacji pierwotna decyzja pozostaje w mocy.',
    genericBody: 'Masz nowe powiadomienie',
  },
  'tr': {
    rankUpTitle: '#{rank}. sıraya yükseldiniz',
    rankMilestoneTitle: '#{rank}. sıraya ulaştınız!',
    deltaOne: 'Bu hafta {delta} sıra yukarı',
    deltaMany: 'Bu hafta {delta} sıra yukarı',
    modRemoved: 'İçeriğiniz kaldırıldı',
    modHidden: 'İçeriğiniz gizlendi',
    modRejected: 'İçeriğiniz onaylanmadı',
    modOther: 'İçeriğinizle ilgili bir karar verildi',
    canAppeal: 'Bu karara itiraz edebilirsiniz.',
    appealApproved: 'İtirazınız kabul edildi',
    appealReviewed: 'İtirazınız incelendi',
    appealRestored: 'İnceleme sonrası içeriğinizi geri yükledik.',
    appealStands: 'İnceleme sonrası ilk karar geçerliliğini koruyor.',
    genericBody: 'Yeni bir bildiriminiz var',
  },
  'id': {
    rankUpTitle: 'Kamu naik ke peringkat #{rank}',
    rankMilestoneTitle: 'Kamu mencapai peringkat #{rank}!',
    deltaOne: 'Naik {delta} peringkat minggu ini',
    deltaMany: 'Naik {delta} peringkat minggu ini',
    modRemoved: 'Konten Anda dihapus',
    modHidden: 'Konten Anda disembunyikan',
    modRejected: 'Konten Anda tidak disetujui',
    modOther: 'Keputusan telah dibuat tentang konten Anda',
    canAppeal: 'Anda dapat mengajukan banding atas keputusan ini.',
    appealApproved: 'Banding Anda disetujui',
    appealReviewed: 'Banding Anda telah ditinjau',
    appealRestored: 'Kami memulihkan konten Anda setelah ditinjau.',
    appealStands: 'Setelah ditinjau, keputusan awal tetap berlaku.',
    genericBody: 'Anda punya notifikasi baru',
  },
  'vi': {
    rankUpTitle: 'Bạn đã lên hạng #{rank}',
    rankMilestoneTitle: 'Bạn đã đạt hạng #{rank}!',
    deltaOne: 'Tăng {delta} hạng tuần này',
    deltaMany: 'Tăng {delta} hạng tuần này',
    modRemoved: 'Nội dung của bạn đã bị gỡ',
    modHidden: 'Nội dung của bạn đã bị ẩn',
    modRejected: 'Nội dung của bạn không được duyệt',
    modOther: 'Đã có quyết định về nội dung của bạn',
    canAppeal: 'Bạn có thể khiếu nại quyết định này.',
    appealApproved: 'Khiếu nại của bạn đã được chấp thuận',
    appealReviewed: 'Khiếu nại của bạn đã được xem xét',
    appealRestored: 'Chúng tôi đã khôi phục nội dung của bạn sau khi xem xét.',
    appealStands: 'Sau khi xem xét, quyết định ban đầu vẫn được giữ nguyên.',
    genericBody: 'Bạn có một thông báo mới',
  },
  'hi': {
    rankUpTitle: 'आप #{rank} पर पहुंच गए',
    rankMilestoneTitle: 'आपने #{rank} हासिल किया!',
    deltaOne: 'इस हफ्ते {delta} स्थान ऊपर',
    deltaMany: 'इस हफ्ते {delta} स्थान ऊपर',
    modRemoved: 'आपकी सामग्री हटा दी गई',
    modHidden: 'आपकी सामग्री छिपा दी गई',
    modRejected: 'आपकी सामग्री स्वीकृत नहीं हुई',
    modOther: 'आपकी सामग्री के बारे में निर्णय लिया गया',
    canAppeal: 'आप इस निर्णय के विरुद्ध अपील कर सकते हैं।',
    appealApproved: 'आपकी अपील स्वीकृत हो गई',
    appealReviewed: 'आपकी अपील की समीक्षा की गई',
    appealRestored: 'समीक्षा के बाद हमने आपकी सामग्री बहाल कर दी।',
    appealStands: 'समीक्षा के बाद, मूल निर्णय बरकरार है।',
    genericBody: 'आपके पास एक नई सूचना है',
  },
  'bn': {
    rankUpTitle: 'আপনি #{rank}-এ উঠে এসেছেন',
    rankMilestoneTitle: 'আপনি #{rank}-এ পৌঁছে গেছেন!',
    deltaOne: 'এই সপ্তাহে {delta} ধাপ উপরে',
    deltaMany: 'এই সপ্তাহে {delta} ধাপ উপরে',
    modRemoved: 'আপনার কনটেন্ট সরানো হয়েছে',
    modHidden: 'আপনার কনটেন্ট লুকানো হয়েছে',
    modRejected: 'আপনার কনটেন্ট অনুমোদিত হয়নি',
    modOther: 'আপনার কনটেন্ট সম্পর্কে একটি সিদ্ধান্ত নেওয়া হয়েছে',
    canAppeal: 'আপনি এই সিদ্ধান্তের বিরুদ্ধে আপিল করতে পারেন।',
    appealApproved: 'আপনার আপিল অনুমোদিত হয়েছে',
    appealReviewed: 'আপনার আপিল পর্যালোচনা করা হয়েছে',
    appealRestored: 'পর্যালোচনার পরে আমরা আপনার কনটেন্ট পুনরুদ্ধার করেছি।',
    appealStands: 'পর্যালোচনার পরে মূল সিদ্ধান্তই বহাল আছে।',
    genericBody: 'আপনার একটি নতুন বিজ্ঞপ্তি আছে',
  },
  'ta': {
    rankUpTitle: 'நீங்கள் #{rank} க்கு முன்னேறினீர்கள்',
    rankMilestoneTitle: 'நீங்கள் #{rank} ஐ எட்டினீர்கள்!',
    deltaOne: 'இந்த வாரம் {delta} இடம் மேலே',
    deltaMany: 'இந்த வாரம் {delta} இடங்கள் மேலே',
    modRemoved: 'உங்கள் உள்ளடக்கம் நீக்கப்பட்டது',
    modHidden: 'உங்கள் உள்ளடக்கம் மறைக்கப்பட்டது',
    modRejected: 'உங்கள் உள்ளடக்கம் அங்கீகரிக்கப்படவில்லை',
    modOther: 'உங்கள் உள்ளடக்கம் குறித்து முடிவு எடுக்கப்பட்டது',
    canAppeal: 'இந்த முடிவை நீங்கள் மேல்முறையீடு செய்யலாம்.',
    appealApproved: 'உங்கள் மேல்முறையீடு ஏற்கப்பட்டது',
    appealReviewed: 'உங்கள் மேல்முறையீடு மதிப்பாய்வு செய்யப்பட்டது',
    appealRestored: 'மதிப்பாய்வுக்குப் பிறகு உங்கள் உள்ளடக்கத்தை மீட்டமைத்தோம்.',
    appealStands: 'மதிப்பாய்வுக்குப் பிறகு, அசல் முடிவே நிலைக்கிறது.',
    genericBody: 'உங்களுக்கு ஒரு புதிய அறிவிப்பு உள்ளது',
  },
  'te': {
    rankUpTitle: 'మీరు #{rank}కు ఎగబాకారు',
    rankMilestoneTitle: 'మీరు #{rank}కు చేరుకున్నారు!',
    deltaOne: 'ఈ వారం {delta} ర్యాంక్ పైకి',
    deltaMany: 'ఈ వారం {delta} ర్యాంకులు పైకి',
    modRemoved: 'మీ కంటెంట్ తొలగించబడింది',
    modHidden: 'మీ కంటెంట్ దాచబడింది',
    modRejected: 'మీ కంటెంట్ ఆమోదించబడలేదు',
    modOther: 'మీ కంటెంట్ గురించి ఒక నిర్ణయం తీసుకోబడింది',
    canAppeal: 'మీరు ఈ నిర్ణయాన్ని అప్పీల్ చేయవచ్చు.',
    appealApproved: 'మీ అప్పీల్ ఆమోదించబడింది',
    appealReviewed: 'మీ అప్పీల్ సమీక్షించబడింది',
    appealRestored: 'సమీక్ష తర్వాత మీ కంటెంట్‌ను పునరుద్ధరించాం.',
    appealStands: 'సమీక్ష తర్వాత, అసలు నిర్ణయమే అమలులో ఉంటుంది.',
    genericBody: 'మీకు ఒక కొత్త నోటిఫికేషన్ ఉంది',
  },
  'th': {
    rankUpTitle: 'คุณขยับขึ้นมาอันดับ #{rank}',
    rankMilestoneTitle: 'คุณไต่ขึ้นถึงอันดับ #{rank}!',
    deltaOne: 'ขึ้น {delta} อันดับในสัปดาห์นี้',
    deltaMany: 'ขึ้น {delta} อันดับในสัปดาห์นี้',
    modRemoved: 'เนื้อหาของคุณถูกลบออก',
    modHidden: 'เนื้อหาของคุณถูกซ่อน',
    modRejected: 'เนื้อหาของคุณไม่ได้รับการอนุมัติ',
    modOther: 'มีการตัดสินใจเกี่ยวกับเนื้อหาของคุณ',
    canAppeal: 'คุณสามารถอุทธรณ์การตัดสินใจนี้ได้',
    appealApproved: 'คำอุทธรณ์ของคุณได้รับการอนุมัติ',
    appealReviewed: 'คำอุทธรณ์ของคุณได้รับการตรวจสอบแล้ว',
    appealRestored: 'เราได้กู้คืนเนื้อหาของคุณหลังการตรวจสอบ',
    appealStands: 'หลังการตรวจสอบ การตัดสินใจเดิมยังคงมีผล',
    genericBody: 'คุณมีการแจ้งเตือนใหม่',
  },
  'ja': {
    rankUpTitle: '#{rank}位に上がりました',
    rankMilestoneTitle: '#{rank}位に到達しました！',
    deltaOne: '今週{delta}ランクアップ',
    deltaMany: '今週{delta}ランクアップ',
    modRemoved: 'コンテンツが削除されました',
    modHidden: 'コンテンツが非表示になりました',
    modRejected: 'コンテンツは承認されませんでした',
    modOther: 'あなたのコンテンツについて決定が下されました',
    canAppeal: 'この決定に異議を申し立てることができます。',
    appealApproved: '異議申し立てが承認されました',
    appealReviewed: '異議申し立てが審査されました',
    appealRestored: '審査の結果、コンテンツを復元しました。',
    appealStands: '審査の結果、当初の決定が維持されます。',
    genericBody: '新しい通知があります',
  },
  'ko': {
    rankUpTitle: '#{rank}위로 올라갔습니다',
    rankMilestoneTitle: '#{rank}위에 도달했습니다!',
    deltaOne: '이번 주 {delta}계단 상승',
    deltaMany: '이번 주 {delta}계단 상승',
    modRemoved: '콘텐츠가 삭제되었습니다',
    modHidden: '콘텐츠가 숨겨졌습니다',
    modRejected: '콘텐츠가 승인되지 않았습니다',
    modOther: '콘텐츠에 대한 결정이 내려졌습니다',
    canAppeal: '이 결정에 이의를 제기할 수 있습니다.',
    appealApproved: '이의 제기가 승인되었습니다',
    appealReviewed: '이의 제기가 검토되었습니다',
    appealRestored: '검토 후 콘텐츠를 복원했습니다.',
    appealStands: '검토 결과 원래 결정이 유지됩니다.',
    genericBody: '새 알림이 있습니다',
  },
  'zh-Hans': {
    rankUpTitle: '你升到了第{rank}名',
    rankMilestoneTitle: '你冲到了第{rank}名！',
    deltaOne: '本周上升{delta}名',
    deltaMany: '本周上升{delta}名',
    modRemoved: '你的内容已被移除',
    modHidden: '你的内容已被隐藏',
    modRejected: '你的内容未获批准',
    modOther: '已就你的内容作出决定',
    canAppeal: '你可以对此决定提出申诉。',
    appealApproved: '你的申诉已获批准',
    appealReviewed: '你的申诉已审核',
    appealRestored: '经过审核，我们已恢复你的内容。',
    appealStands: '经过审核，维持原决定。',
    genericBody: '你有一条新通知',
  },
  'zh-Hant': {
    rankUpTitle: '你升到第{rank}名',
    rankMilestoneTitle: '你衝上第{rank}名！',
    deltaOne: '本週上升{delta}名',
    deltaMany: '本週上升{delta}名',
    modRemoved: '你的內容已被移除',
    modHidden: '你的內容已被隱藏',
    modRejected: '你的內容未獲批准',
    modOther: '已就你的內容作出決定',
    canAppeal: '你可以對此決定提出申訴。',
    appealApproved: '你的申訴已獲批准',
    appealReviewed: '你的申訴已審核',
    appealRestored: '經過審核，我們已還原你的內容。',
    appealStands: '經過審核，維持原決定。',
    genericBody: '你有一則新通知',
  },
  'ar': {
    rankUpTitle: 'صعدت إلى المركز #{rank}',
    rankMilestoneTitle: 'وصلت إلى المركز #{rank}!',
    deltaOne: 'تقدمت {delta} مركزًا هذا الأسبوع',
    deltaMany: 'تقدمت {delta} مراكز هذا الأسبوع',
    modRemoved: 'تمت إزالة محتواك',
    modHidden: 'تم إخفاء محتواك',
    modRejected: 'لم تتم الموافقة على محتواك',
    modOther: 'تم اتخاذ قرار بشأن محتواك',
    canAppeal: 'يمكنك الطعن في هذا القرار.',
    appealApproved: 'تمت الموافقة على طعنك',
    appealReviewed: 'تمت مراجعة طعنك',
    appealRestored: 'أعدنا محتواك بعد المراجعة.',
    appealStands: 'بعد المراجعة، يبقى القرار الأصلي قائمًا.',
    genericBody: 'لديك إشعار جديد',
  },
  'he': {
    rankUpTitle: 'עליתם למקום #{rank}',
    rankMilestoneTitle: 'הגעתם למקום #{rank}!',
    deltaOne: 'עלייה של מקום {delta} השבוע',
    deltaMany: 'עלייה של {delta} מקומות השבוע',
    modRemoved: 'התוכן שלך הוסר',
    modHidden: 'התוכן שלך הוסתר',
    modRejected: 'התוכן שלך לא אושר',
    modOther: 'התקבלה החלטה בנוגע לתוכן שלך',
    canAppeal: 'אפשר לערער על ההחלטה הזו.',
    appealApproved: 'הערעור שלך אושר',
    appealReviewed: 'הערעור שלך נבדק',
    appealRestored: 'שחזרנו את התוכן שלך לאחר הבדיקה.',
    appealStands: 'לאחר הבדיקה, ההחלטה המקורית נותרה בתוקף.',
    genericBody: 'יש לך התראה חדשה',
  },
};

/** Brand title used for the generic fallback push (locale-invariant). */
const BRAND_TITLE = 'BestChef';

function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? params[key] : `{${key}}`,
  );
}

function strForLocale(locale: PushLocale): FlagshipStrings {
  return STRINGS[locale] ?? STRINGS[DEFAULT_PUSH_LOCALE];
}

function str(params: Record<string, unknown>, key: string): string | null {
  const value = params[key];
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Localized {title, body} for a flagship push. Non-flagship kinds get the
 * generic fallback so a mis-enqueued row still delivers something sensible
 * rather than empty text.
 */
export function renderPushCopy(
  kind: string,
  params: Record<string, unknown>,
  locale: PushLocale,
): { title: string; body: string } {
  const s = strForLocale(locale);

  switch (kind) {
    case 'rank_up':
    case 'rank_milestone': {
      const rank = str(params, 'new_rank') ?? '';
      const delta = str(params, 'delta') ?? '';
      const deltaNum = Number.parseInt(delta, 10);
      const title = kind === 'rank_milestone'
        ? fill(s.rankMilestoneTitle, { rank })
        : fill(s.rankUpTitle, { rank });
      const body = delta
        ? fill(deltaNum === 1 ? s.deltaOne : s.deltaMany, { delta })
        : '';
      return { title, body };
    }
    case 'moderation_decision': {
      const decision = str(params, 'decision') ?? '';
      const appealAvailable = params['appeal_available'] === true;
      let title: string;
      switch (decision) {
        case 'removed':
          title = s.modRemoved;
          break;
        case 'hidden':
          title = s.modHidden;
          break;
        case 'rejected':
          title = s.modRejected;
          break;
        default:
          title = s.modOther;
      }
      return { title, body: appealAvailable ? s.canAppeal : '' };
    }
    case 'appeal_resolved': {
      const outcome = str(params, 'outcome') ?? '';
      return outcome === 'overturned'
        ? { title: s.appealApproved, body: s.appealRestored }
        : { title: s.appealReviewed, body: s.appealStands };
    }
    default:
      return { title: BRAND_TITLE, body: s.genericBody };
  }
}
