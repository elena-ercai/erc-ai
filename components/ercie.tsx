'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shipment } from '@/lib/models';
import { getHsCodeSources, HsCodeSource } from '@/lib/hs-code-sources';
import {
  AppShell, PageHeader, Stepper, PrimaryButton, SectionTitle,
  CountrySelect, cx,
} from '@/lib/app-components';
import {
  AlertTriangle, ArrowRight, Bot, CheckCircle2, ChevronDown, ChevronLeft,
  ExternalLink, Globe2, Info, MessageSquare, Search, SkipForward, UploadCloud, User,
} from 'lucide-react';

// ─── Languages ───────────────────────────────────────────────────────────────

type Lang = 'en' | 'zh-TW' | 'zh-CN' | 'ja';

const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'zh-TW', label: 'Traditional Chinese', native: '繁體中文' },
  { code: 'zh-CN', label: 'Simplified Chinese', native: '简体中文' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
];

interface Strings {
  ercieName: string;
  ercieTagline: string;
  pickLanguage: string;
  startFilling: string;
  next: string;
  back: string;
  skip: string;
  dontKnow: string;
  confirm: string;
  reAsk: string;
  markedUnknown: string;
  reviewTitle: string;
  reviewIntro: string;
  startCheck: string;
  editAnswer: string;
  requiredMissing: string;
  fieldHelp: Record<string, string>;
  fieldAsk: Record<string, string>;
  fieldReAsk: Record<string, string>;
  buyerNote: string;
  hsCodeInvalid: string;
  hsCodeLookup: string;
  hsCodeNoSource: string;
  hsCodeNoSourceHelp: string;
  hsCodeReconfirm: string;
  hsCodeReconfirmPrompt: string;
  hsCodeKeep: string;
  hsCodeSearchTitle: string;
  originNote: string;
  uploadComingSoon: string;
  reviewOriginal: string;
  reviewEnglishForm: string;
  reviewModifyNote: string;
}

const STRINGS: Record<Lang, Strings> = {
  'en': {
    ercieName: 'Ercie',
    ercieTagline: 'Your export risk assistant',
    pickLanguage: 'Hi! I\'m Ercie. I\'ll guide you through a few questions about your product and trade plan. What language would you like to use?',
    startFilling: 'Great! Let\'s start. I\'ll explain each field briefly, then ask you to fill it in.',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    dontKnow: 'I don\'t know',
    confirm: 'Confirm',
    reAsk: 'No problem — let me ask differently.',
    markedUnknown: 'Marked as Unknown / to be confirmed.',
    reviewTitle: 'Review Your Answers',
    reviewIntro: 'Please review your answers and the English form below. You can edit any field. When you\'re ready, click "Start Risk Check".',
    startCheck: 'Start Risk Check',
    editAnswer: 'Edit',
    requiredMissing: 'This field is required. Please provide a value before continuing.',
    fieldHelp: {
      productName: 'Tell me what product you plan to export. A clear name or description helps ERC AI identify relevant regulations.',
      exportCountry: 'Which country or territory are you exporting from? This determines which HS Code lookup source and export-side regulations apply.',
      hsCode: 'What is the HS Code for your product? It must be 6 or 8 digits. If you don\'t know it, I can show you where to look it up based on your export country.',
      countryOfOrigin: 'Where was the product manufactured or produced? You can tell me, or confirm from a Certificate of Origin if you have one. You don\'t have to upload anything.',
      destinationCountry: 'Which country or market are you planning to export to? This determines which destination-side regulations and requirements apply.',
      buyerImporter: 'Do you have a specific buyer or importer in mind? Providing this enables buyer risk screening. You can skip this if you don\'t have a buyer yet.',
      productCategory: 'What category does your product fall under? (e.g., electronics, textiles, metals) This helps narrow down applicable rules.',
      productCharacteristics: 'Any key features of your product? (e.g., material, composition, intended use details) This helps with classification accuracy.',
      endUse: 'What will the product be used for in the destination market? This can affect export control and regulatory requirements.',
      supplyChainInfo: 'Any supply-chain details you can share? (e.g., raw material sources, manufacturing location) This helps with origin and sustainability checks.',
      certificates: 'Do you have any certificates or documents ready? (e.g., Mill Certificate, Certificate of Origin) This helps assess evidence readiness.',
      plannedImportDate: 'When do you plan to import the goods into the destination market? This helps check if regulations are active, upcoming, or transitional.',
    },
    fieldAsk: {
      productName: 'What product would you like to check?',
      exportCountry: 'Which country are you exporting from?',
      hsCode: 'What is the HS Code for your product?',
      countryOfOrigin: 'Where was this product manufactured or produced?',
      destinationCountry: 'Which country or market are you exporting to?',
      buyerImporter: 'Do you have a buyer or importer? (Optional — you can skip this.)',
      productCategory: 'What category does your product fall under? (Optional)',
      productCharacteristics: 'Any key product characteristics? (Optional)',
      endUse: 'What is the intended end use? (Optional)',
      supplyChainInfo: 'Any supply-chain information? (Optional)',
      certificates: 'Any known certificates or documents? (Optional)',
      plannedImportDate: 'When do you plan to import? (Optional)',
    },
    fieldReAsk: {
      productName: 'Could you describe the product in a few words? Even a general description is helpful.',
      exportCountry: 'Which country or territory will the goods ship from?',
      hsCode: 'Do you have the HS Code? It\'s usually 6 or 8 digits. You can also look it up using the search button.',
      countryOfOrigin: 'In which country was the product made? If you\'re not sure, we can mark it as Unknown for now.',
      destinationCountry: 'Which market are you considering exporting to?',
      buyerImporter: 'If you have a potential buyer name, you can share it. Otherwise, just skip — you can still run the other checks.',
      productCategory: 'Any broad category that fits your product?',
      productCharacteristics: 'Any details about materials or features?',
      endUse: 'Any idea how the product will be used?',
      supplyChainInfo: 'Any details about where materials come from?',
      certificates: 'Any documents you already have?',
      plannedImportDate: 'Any approximate date in mind?',
    },
    buyerNote: 'Providing buyer information enables buyer risk screening. Without it, other checks still run.',
    hsCodeInvalid: 'HS Code must be 6 or 8 digits (numbers only). 7-digit codes are not accepted.',
    hsCodeLookup: 'Search HS Code',
    hsCodeNoSource: 'No verified HS Code lookup source is available for this export country yet.',
    hsCodeNoSourceHelp: 'Please confirm your HS Code with the relevant customs authority or a licensed customs broker in your export country.',
    hsCodeReconfirm: 'Please re-confirm this HS Code for your new export country.',
    hsCodeReconfirmPrompt: 'You changed the export country. Please confirm this HS Code is still correct for the new country.',
    hsCodeKeep: 'Confirm HS Code',
    hsCodeSearchTitle: 'Official HS Code Lookup',
    originNote: 'Country of origin is based on your input or a Certificate of Origin you confirm. ERC AI does not verify origin independently.',
    uploadComingSoon: 'Document-assisted form filling is coming soon. For now, please fill in the fields manually.',
    reviewOriginal: 'Your Answers',
    reviewEnglishForm: 'English Form (sent to risk check)',
    reviewModifyNote: 'You can edit any field above. Changes will be reflected in the form sent to the risk check.',
  },
  'zh-TW': {
    ercieName: '艾希',
    ercieTagline: '您的出口風險助手',
    pickLanguage: '您好！我是艾希。我會引導您填寫幾項產品與貿易資訊。請問您想使用哪種語言？',
    startFilling: '好的，我們開始吧！我會先簡短說明每個欄位的用途，再請您填寫。',
    next: '下一步',
    back: '上一步',
    skip: '跳過',
    dontKnow: '不知道',
    confirm: '確認',
    reAsk: '沒關係，我換個方式問。',
    markedUnknown: '已標示為 Unknown／待確認。',
    reviewTitle: '核對您的回答',
    reviewIntro: '請核對您的回答與下方的英文表單。您可以修改任何欄位。確認後請按「開始風險檢查」。',
    startCheck: '開始風險檢查',
    editAnswer: '修改',
    requiredMissing: '此欄位為必填，請提供內容後再繼續。',
    fieldHelp: {
      productName: '請告訴我您打算出口什麼產品。清楚的名稱或描述有助於 ERC AI 找出適用的法規。',
      exportCountry: '您從哪個國家或地區出口？這決定了適用的 HS Code 查詢來源與出口端法規。',
      hsCode: '您產品的 HS Code 是多少？必須是 6 碼或 8 碼數字。如果不知道，我可以根據出口國提供查詢來源。',
      countryOfOrigin: '產品在哪裡製造或生產？您可以口述，或從原產地證明確認。不需要強制上傳證明。',
      destinationCountry: '您打算出口到哪個國家或市場？這決定了目的端法規與要求。',
      buyerImporter: '您有特定的買主或進口商嗎？提供買主資料可增加買主風險檢查。目前沒有買主也可以執行其他檢查。',
      productCategory: '您的產品屬於哪個類別？（例如電子、紡織、金屬）這有助於縮小適用法規。',
      productCharacteristics: '產品有什麼關鍵特性？（例如材質、成分、用途細節）這有助於分類準確度。',
      endUse: '產品在目的市場的用途是什麼？這可能影響出口管制與法規要求。',
      supplyChainInfo: '有任何供應鏈資訊嗎？（例如原料來源、製造地點）這有助於原產地與永續檢查。',
      certificates: '您已有哪些證書或文件？（例如磨坊證明、原產地證明）這有助於評估證據準備度。',
      plannedImportDate: '您預計何時將貨品進口到目的市場？這有助於判斷法規是否已生效、即將生效或過渡期。',
    },
    fieldAsk: {
      productName: '您想檢查什麼產品？',
      exportCountry: '您從哪個國家出口？',
      hsCode: '您產品的 HS Code 是多少？',
      countryOfOrigin: '這項產品在哪裡製造或生產？',
      destinationCountry: '您打算出口到哪個國家或市場？',
      buyerImporter: '您有買主或進口商嗎？（選填，可跳過）',
      productCategory: '產品屬於哪個類別？（選填）',
      productCharacteristics: '有任何關鍵產品特性嗎？（選填）',
      endUse: '預計的最终用途是什麼？（選填）',
      supplyChainInfo: '有任何供應鏈資訊嗎？（選填）',
      certificates: '有任何已知的證書或文件嗎？（選填）',
      plannedImportDate: '預計何時進口？（選填）',
    },
    fieldReAsk: {
      productName: '能用幾個字描述一下產品嗎？即使是大概的描述也有幫助。',
      exportCountry: '貨品會從哪個國家或地區出貨？',
      hsCode: '您有 HS Code 嗎？通常是 6 碼或 8 碼。也可以用查詢按鈕查找。',
      countryOfOrigin: '產品在哪個國家製造的？如果不確定，可以先標示為 Unknown。',
      destinationCountry: '您考慮出口到哪個市場？',
      buyerImporter: '如果有潛在買主名稱可以提供。沒有的話直接跳過——其他檢查仍可執行。',
      productCategory: '產品大致屬於哪個類別？',
      productCharacteristics: '有任何材質或特性的細節嗎？',
      endUse: '知道產品會怎麼使用嗎？',
      supplyChainInfo: '知道原料從哪裡來嗎？',
      certificates: '已經有哪些文件了嗎？',
      plannedImportDate: '有大約的日期嗎？',
    },
    buyerNote: '提供買主資料可增加買主風險檢查。沒有買主時仍可執行其他檢查。',
    hsCodeInvalid: 'HS Code 必須為 6 碼或 8 碼數字，不接受 7 碼。',
    hsCodeLookup: '查詢 HS Code',
    hsCodeNoSource: '目前尚無此出口國的站內查詢連結。',
    hsCodeNoSourceHelp: '請向該國主管機關或報關專業人士確認 HS Code。',
    hsCodeReconfirm: '請依新的出口國重新確認此 HS Code。',
    hsCodeReconfirmPrompt: '您已更改出口國，請確認此 HS Code 在新國家仍然正確。',
    hsCodeKeep: '確認 HS Code',
    hsCodeSearchTitle: '官方 HS Code 查詢',
    originNote: '原產地依您說明或自願上傳的原產地證明由您確認，ERC AI 不自行核定原產地。',
    uploadComingSoon: '文件輔助填表功能即將推出。目前請手動填寫各欄位。',
    reviewOriginal: '您的回答',
    reviewEnglishForm: '英文表單（送入風險檢查）',
    reviewModifyNote: '您可以修改上方任何欄位，修改後將反映在送檢的英文表單中。',
  },
  'zh-CN': {
    ercieName: '艾希',
    ercieTagline: '您的出口风险助手',
    pickLanguage: '您好！我是艾希。我会引导您填写几项产品与贸易信息。请问您想使用哪种语言？',
    startFilling: '好的，我们开始吧！我会先简要说明每个栏位的用途，再请您填写。',
    next: '下一步',
    back: '上一步',
    skip: '跳过',
    dontKnow: '不知道',
    confirm: '确认',
    reAsk: '没关系，我换个方式问。',
    markedUnknown: '已标记为 Unknown／待确认。',
    reviewTitle: '核对您的回答',
    reviewIntro: '请核对您的回答与下方的英文表单。您可以修改任何栏位。确认后请按"开始风险检查"。',
    startCheck: '开始风险检查',
    editAnswer: '修改',
    requiredMissing: '此栏位为必填，请提供内容后再继续。',
    fieldHelp: {
      productName: '请告诉我您打算出口什么产品。清楚的名称或描述有助于 ERC AI 找出适用的法规。',
      exportCountry: '您从哪个国家或地区出口？这决定了适用的 HS Code 查询来源与出口端法规。',
      hsCode: '您产品的 HS Code 是多少？必须是 6 码或 8 码数字。如果不知道，我可以根据出口国提供查询来源。',
      countryOfOrigin: '产品在哪里制造或生产？您可以口述，或从原产地证明确认。不需要强制上传证明。',
      destinationCountry: '您打算出口到哪个国家或市场？这决定了目的端法规与要求。',
      buyerImporter: '您有特定的买主或进口商吗？提供买主资料可增加买主风险检查。目前没有买主也可以执行其他检查。',
      productCategory: '您的产品属于哪个类别？（例如电子、纺织、金属）这有助于缩小适用法规。',
      productCharacteristics: '产品有什么关键特性？（例如材质、成分、用途细节）这有助于分类准确度。',
      endUse: '产品在目的市场的用途是什么？这可能影响出口管制与法规要求。',
      supplyChainInfo: '有任何供应链信息吗？（例如原料来源、制造地点）这有助于原产地与可持续检查。',
      certificates: '您已有哪些证书或文件？（例如厂证、原产地证明）这有助于评估证据准备度。',
      plannedImportDate: '您预计何时将货物进口到目的市场？这有助于判断法规是否已生效、即将生效或过渡期。',
    },
    fieldAsk: {
      productName: '您想检查什么产品？',
      exportCountry: '您从哪个国家出口？',
      hsCode: '您产品的 HS Code 是多少？',
      countryOfOrigin: '这项产品在哪里制造或生产？',
      destinationCountry: '您打算出口到哪个国家或市场？',
      buyerImporter: '您有买主或进口商吗？（选填，可跳过）',
      productCategory: '产品属于哪个类别？（选填）',
      productCharacteristics: '有任何关键产品特性吗？（选填）',
      endUse: '预计的最终用途是什么？（选填）',
      supplyChainInfo: '有任何供应链信息吗？（选填）',
      certificates: '有任何已知的证书或文件吗？（选填）',
      plannedImportDate: '预计何时进口？（选填）',
    },
    fieldReAsk: {
      productName: '能用几个字描述一下产品吗？即使是大概的描述也有帮助。',
      exportCountry: '货物会从哪个国家或地区出货？',
      hsCode: '您有 HS Code 吗？通常是 6 碼或 8 码。也可以用查询按钮查找。',
      countryOfOrigin: '产品在哪个国家制造的？如果不确定，可以先标记为 Unknown。',
      destinationCountry: '您考虑出口到哪个市场？',
      buyerImporter: '如果有潜在买主名称可以提供。没有的话直接跳过——其他检查仍可执行。',
      productCategory: '产品大致属于哪个类别？',
      productCharacteristics: '有任何材质或特性的细节吗？',
      endUse: '知道产品会怎么使用吗？',
      supplyChainInfo: '知道原料从哪里来吗？',
      certificates: '已经有哪些文件了吗？',
      plannedImportDate: '有大约的日期吗？',
    },
    buyerNote: '提供买主资料可增加买主风险检查。没有买主时仍可执行其他检查。',
    hsCodeInvalid: 'HS Code 必须为 6 码或 8 码数字，不接受 7 码。',
    hsCodeLookup: '查询 HS Code',
    hsCodeNoSource: '目前尚无此出口国的站内查询链接。',
    hsCodeNoSourceHelp: '请向该国主管机关或报关专业人士确认 HS Code。',
    hsCodeReconfirm: '请依新的出口国重新确认此 HS Code。',
    hsCodeReconfirmPrompt: '您已更改出口国，请确认此 HS Code 在新国家仍然正确。',
    hsCodeKeep: '确认 HS Code',
    hsCodeSearchTitle: '官方 HS Code 查询',
    originNote: '原产地依您说明或自愿上传的原产地证明由您确认，ERC AI 不自行核定原产地。',
    uploadComingSoon: '文件辅助填表功能即将推出。目前请手动填写各栏位。',
    reviewOriginal: '您的回答',
    reviewEnglishForm: '英文表单（送入风险检查）',
    reviewModifyNote: '您可以修改上方任何栏位，修改后将反映在送检的英文表单中。',
  },
  'ja': {
    ercieName: 'アーシー',
    ercieTagline: '輸出リスクアシスタント',
    pickLanguage: 'こんにちは！アーシーです。製品と貿易計画についていくつか質問します。どの言語を使いますか？',
    startFilling: 'では始めましょう。各項目の目的を簡単に説明してから、入力をお願いします。',
    next: '次へ',
    back: '戻る',
    skip: 'スキップ',
    dontKnow: '分からない',
    confirm: '確認',
    reAsk: '大丈夫です、言い方を変えて聞きます。',
    markedUnknown: 'Unknown／要確認として記録しました。',
    reviewTitle: '回答の確認',
    reviewIntro: '回答と下記の英語フォームを確認してください。編集できます。準備ができたら「リスクチェック開始」を押してください。',
    startCheck: 'リスクチェック開始',
    editAnswer: '編集',
    requiredMissing: 'この項目は必須です。入力してから続行してください。',
    fieldHelp: {
      productName: '輸出予定の製品を教えてください。明確な名称や説明があれば、ERC AI が該当する規制を特定しやすくなります。',
      exportCountry: 'どの国・地域から輸出しますか？これにより HS Code の検索先と輸出側の規制が決まります。',
      hsCode: '製品の HS Code は何ですか？6 桁または 8 桁である必要があります。分からない場合は、輸出国に基づいて検索先を案内します。',
      countryOfOrigin: '製品はどこで製造・生産されましたか？お聞きするか、原産地証明書があれば確認できます。アップロードは必須ではありません。',
      destinationCountry: 'どの国・市場への輸出を検討していますか？これにより輸入先の規制と要件が決まります。',
      buyerImporter: '特定のバイヤーや輸入業者はいますか？提供するとバイヤーリスクスクリーニングが有効になります。いない場合はスキップできます。',
      productCategory: '製品のカテゴリーは？（例：電子、繊維、金属）該当する規制を絞り込むのに役立ちます。',
      productCharacteristics: '製品の主な特徴は？（例：材質、成分、用途の詳細）分類の精度に役立ちます。',
      endUse: '目的市場での製品の用途は？輸出管理や規制要件に影響する可能性があります。',
      supplyChainInfo: 'サプライチェーンの詳細はありますか？（例：原料の調達先、製造場所）原産地とサステナビリティの確認に役立ちます。',
      certificates: '準備済みの証明書や書類はありますか？（例：ミル証明書、原産地証明書）証拠の準備状況の評価に役立ちます。',
      plannedImportDate: '輸入予定日はいつですか？規制が有効、予定、移行期のいずれかを判断するのに役立ちます。',
    },
    fieldAsk: {
      productName: 'どの製品をチェックしますか？',
      exportCountry: 'どの国から輸出しますか？',
      hsCode: '製品の HS Code は何ですか？',
      countryOfOrigin: 'この製品はどこで製造されましたか？',
      destinationCountry: 'どの国・市場に輸出しますか？',
      buyerImporter: 'バイヤーや輸入業者はいますか？（任意・スキップ可）',
      productCategory: '製品のカテゴリーは？（任意）',
      productCharacteristics: '主な製品特徴はありますか？（任意）',
      endUse: '想定される最終用途は？（任意）',
      supplyChainInfo: 'サプライチェーン情報はありますか？（任意）',
      certificates: '既知の証明書や書類はありますか？（任意）',
      plannedImportDate: '輸入予定日は？（任意）',
    },
    fieldReAsk: {
      productName: '製品をいくつかの言葉で説明できますか？大まかな説明でも役立ちます。',
      exportCountry: '貨物はどの国・地域から出荷されますか？',
      hsCode: 'HS Code はありますか？通常 6 桁または 8 桁です。検索ボタンで調べることもできます。',
      countryOfOrigin: '製品はどの国で作られましたか？分からない場合は Unknown として記録できます。',
      destinationCountry: '輸出を検討している市場はどこですか？',
      buyerImporter: '潜在的なバイヤー名があれば教えてください。なければスキップできます—他のチェックは引き続き実行できます。',
      productCategory: '製品に当てはまる大まかなカテゴリーは？',
      productCharacteristics: '材質や特徴の詳細は？',
      endUse: '製品の使い方が分かりますか？',
      supplyChainInfo: '原料の調達先は分かりますか？',
      certificates: '既に持っている書類は？',
      plannedImportDate: 'おおよその日付は？',
    },
    buyerNote: 'バイヤー情報を提供するとバイヤーリスクチェックが有効になります。いない場合も他のチェックは実行されます。',
    hsCodeInvalid: 'HS Code は 6 桁または 8 桁の数字のみです。7 桁は受け付けません。',
    hsCodeLookup: 'HS Code 検索',
    hsCodeNoSource: 'この輸出国の確認済み HS Code 検索リンクはまだありません。',
    hsCodeNoSourceHelp: '該当国の税関当局または通関業者に HS Code をご確認ください。',
    hsCodeReconfirm: '新しい輸出国についてこの HS Code を再確認してください。',
    hsCodeReconfirmPrompt: '輸出国を変更しました。この HS Code が新しい国でも正しいか確認してください。',
    hsCodeKeep: 'HS Code を確認',
    hsCodeSearchTitle: '公式 HS Code 検索',
    originNote: '原産地はお客様の回答または確認された原産地証明書に基づきます。ERC AI は原産地を独自に認定しません。',
    uploadComingSoon: '書類サポート入力機能は近日公開予定。今は手動で入力してください。',
    reviewOriginal: 'あなたの回答',
    reviewEnglishForm: '英語フォーム（リスクチェックに送信）',
    reviewModifyNote: '上記の任意の項目を編集できます。変更は送信されるフォームに反映されます。',
  },
};

// ─── Field definitions ───────────────────────────────────────────────────────

type FieldKey =
  | 'productName' | 'exportCountry' | 'hsCode' | 'countryOfOrigin'
  | 'destinationCountry' | 'buyerImporter' | 'productCategory'
  | 'productCharacteristics' | 'endUse' | 'supplyChainInfo'
  | 'certificates' | 'plannedImportDate';

interface FieldDef {
  key: FieldKey;
  required: boolean;
  type: 'text' | 'textarea' | 'country' | 'date' | 'hscode';
  label: string;
}

const FIELD_DEFS: FieldDef[] = [
  { key: 'productName', required: true, type: 'text', label: 'Product name / description' },
  { key: 'exportCountry', required: true, type: 'country', label: 'Export country' },
  { key: 'hsCode', required: true, type: 'hscode', label: 'HS Code' },
  { key: 'countryOfOrigin', required: true, type: 'country', label: 'Country of origin' },
  { key: 'destinationCountry', required: true, type: 'country', label: 'Destination country' },
  { key: 'buyerImporter', required: false, type: 'text', label: 'Buyer / Importer' },
  { key: 'productCategory', required: false, type: 'text', label: 'Product category' },
  { key: 'productCharacteristics', required: false, type: 'textarea', label: 'Key product characteristics' },
  { key: 'endUse', required: false, type: 'textarea', label: 'End use' },
  { key: 'supplyChainInfo', required: false, type: 'textarea', label: 'Supply-chain information' },
  { key: 'certificates', required: false, type: 'text', label: 'Known certificates / documents' },
  { key: 'plannedImportDate', required: false, type: 'date', label: 'Planned import date' },
];

const REQUIRED_FIELDS: FieldKey[] = ['productName', 'hsCode', 'exportCountry', 'countryOfOrigin', 'destinationCountry'];

// ─── HS Code validation ──────────────────────────────────────────────────────

function isValidHsCode(code: string): boolean {
  const cleaned = code.replace(/[^0-9]/g, '');
  return cleaned.length === 6 || cleaned.length === 8;
}

// ─── Country name extraction ──────────────────────────────────────────────────
// Maps Chinese, Japanese, and English country aliases to canonical English names.

const COUNTRY_ALIASES: [RegExp, string][] = [
  [/臺灣|台灣|台湾|Taiwan/i, 'Taiwan'],
  [/德國|德国|Germany|Deutschland/i, 'Germany'],
  [/美國|美国|美利堅|United States|USA|U\.S\.A\.|U\.S\./i, 'United States'],
  [/英國|英国|United Kingdom|UK|Britain|England/i, 'United Kingdom'],
  [/日本|Japan/i, 'Japan'],
  [/新加坡|Singapore/i, 'Singapore'],
  [/澳洲|澳大利亞|澳大利亚|Australia/i, 'Australia'],
  [/加拿大|Canada/i, 'Canada'],
  [/韓國|韩国|South Korea|Korea/i, 'South Korea'],
  [/中國|中国|China|PRC/i, 'China'],
  [/香港|Hong Kong/i, 'Hong Kong'],
  [/法國|法国|France/i, 'France'],
  [/荷蘭|荷兰|Netherlands|Holland/i, 'Netherlands'],
  [/義大利|意大利|Italy/i, 'Italy'],
  [/西班牙|Spain/i, 'Spain'],
  [/瑞典|Sweden/i, 'Sweden'],
  [/瑞士|Switzerland/i, 'Switzerland'],
  [/印度|India/i, 'India'],
  [/越南|Vietnam/i, 'Vietnam'],
  [/泰國|泰国|Thailand/i, 'Thailand'],
  [/馬來西亞|马来西亚|Malaysia/i, 'Malaysia'],
  [/印尼|Indonesia/i, 'Indonesia'],
  [/菲律賓|菲律宾|Philippines/i, 'Philippines'],
  [/墨西哥|Mexico/i, 'Mexico'],
  [/巴西|Brazil/i, 'Brazil'],
  [/阿根廷|Argentina/i, 'Argentina'],
  [/波蘭|波兰|Poland/i, 'Poland'],
  [/土耳其|Turkey/i, 'Turkey'],
  [/沙烏地阿拉伯|沙特阿拉伯|Saudi Arabia/i, 'Saudi Arabia'],
  [/阿聯酋|阿联酋|United Arab Emirates|UAE/i, 'United Arab Emirates'],
  [/歐盟|欧盟|European Union|EU(?!\s*UAE)/i, 'European Union'],
  [/俄羅斯|俄罗斯|Russia/i, 'Russia'],
  [/埃及|Egypt/i, 'Egypt'],
  [/奈及利亞|尼日利亚|Nigeria/i, 'Nigeria'],
  [/南非|South Africa/i, 'South Africa'],
  [/以色列|Israel/i, 'Israel'],
  [/挪威|Norway/i, 'Norway'],
  [/丹麥|丹麦|Denmark/i, 'Denmark'],
  [/芬蘭|芬兰|Finland/i, 'Finland'],
  [/比利時|比利时|Belgium/i, 'Belgium'],
  [/奧地利|奥地利|Austria/i, 'Austria'],
  [/葡萄牙|Portugal/i, 'Portugal'],
  [/希臘|希腊|Greece/i, 'Greece'],
  [/捷克|Czech/i, 'Czech Republic'],
  [/匈牙利|Hungary/i, 'Hungary'],
  [/羅馬尼亞|罗马尼亚|Romania/i, 'Romania'],
  [/柬埔寨|Cambodia/i, 'Cambodia'],
  [/斯里蘭卡|斯里兰卡|Sri Lanka/i, 'Sri Lanka'],
  [/巴基斯坦|Pakistan/i, 'Pakistan'],
  [/孟加拉|Bangladesh/i, 'Bangladesh'],
  [/迦納|加纳|Ghana/i, 'Ghana'],
  [/肯亞|肯尼亚|Kenya/i, 'Kenya'],
  [/科威特|Kuwait/i, 'Kuwait'],
  [/卡達|卡塔尔|Qatar/i, 'Qatar'],
  [/智利|Chile/i, 'Chile'],
  [/哥倫比亞|哥伦比亚|Colombia/i, 'Colombia'],
  [/秘魯|秘鲁|Peru/i, 'Peru'],
  [/厄瓜多|Ecuador/i, 'Ecuador'],
  [/哥斯大黎加|哥斯达黎加|Costa Rica/i, 'Costa Rica'],
  [/摩洛哥|Morocco/i, 'Morocco'],
  [/烏克蘭|乌克兰|Ukraine/i, 'Ukraine'],
  [/紐西蘭|新西兰|New Zealand/i, 'New Zealand'],
  [/尚比亞|赞比亚|Zambia/i, 'Zambia'],
];

// Patterns indicating export-from relationship (Chinese, Japanese, English)
const EXPORT_FROM_PATTERNS = [
  /(?:從|从|由|自)(.{2,20?})(?:出口|輸出|输出|出货|出貨)/,
  /(.{2,20?})(?:出口|輸出|输出)(?:到|至|去|向)/,
  /export(?:ing)?\s+from\s+([A-Za-z\s]+?)(?:\s+to|\s*$)/i,
  /from\s+([A-Za-z\s]+?)\s+to\s+/i,
];

// Patterns indicating destination (Chinese, Japanese, English)
const EXPORT_TO_PATTERNS = [
  /(?:到|至|去|向|銷往|销往|出口到|輸出到|输出到)(.{2,20?})(?:市場|市场|市|$| )/,
  /(?:出口|輸出|输出|賣|卖|銷|销)(?:到|至|去|向)(.{2,20?})(?:$|，|,|\s|市)/,
  /to\s+([A-Za-z\s]+?)(?:\s+market|\s*$|,)/i,
  /export(?:ing)?\s+to\s+([A-Za-z\s]+?)(?:\s*$|,)/i,
];

interface ExtractedCountries {
  exportCountry?: string;
  destinationCountry?: string;
}

function extractCountriesFromText(text: string): ExtractedCountries {
  const result: ExtractedCountries = {};

  // Try to find export-from country
  for (const pattern of EXPORT_FROM_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const fragment = m[1].trim();
      for (const [alias, canonical] of COUNTRY_ALIASES) {
        if (alias.test(fragment)) { result.exportCountry = canonical; break; }
      }
      if (result.exportCountry) break;
    }
  }

  // Try to find destination country
  for (const pattern of EXPORT_TO_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const fragment = m[1].trim();
      for (const [alias, canonical] of COUNTRY_ALIASES) {
        if (alias.test(fragment)) { result.destinationCountry = canonical; break; }
      }
      if (result.destinationCountry) break;
    }
  }

  // Fallback: scan full text for any country mentions.
  // First mention = exportCountry (if not found yet), second distinct mention = destinationCountry.
  if (!result.exportCountry || !result.destinationCountry) {
    const found: string[] = [];
    for (const [alias, canonical] of COUNTRY_ALIASES) {
      if (alias.test(text) && !found.includes(canonical)) {
        found.push(canonical);
        if (found.length === 2) break;
      }
    }
    // Only assign if we found exactly the right cues
    if (found.length >= 1 && !result.exportCountry) result.exportCountry = found[0];
    if (found.length >= 2 && !result.destinationCountry) result.destinationCountry = found[1];
  }

  return result;
}

// ─── Chat message type ───────────────────────────────────────────────────────

interface ChatMessage {
  role: 'ercie' | 'user';
  text: string;
  fieldKey?: FieldKey;
}

// ─── Wizard component ────────────────────────────────────────────────────────

function blankShipment(): Shipment {
  return {
    productName: '', hsCode: '', productCategory: '', productCharacteristics: '',
    exportingCountry: '', destinationCountry: '', countryOfOrigin: '',
    buyerImporter: '', plannedImportDate: '', endUse: '',
    supplyChainInformation: '', certificates: '',
  };
}

export function ErcieWizard() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang | null>(null);
  const [step, setStep] = useState(-1); // -1 = language selection, 0..N = fields, N+1 = review
  const [shipment, setShipment] = useState<Shipment>(blankShipment());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [dontKnowCount, setDontKnowCount] = useState(0);
  const [hsCodeConfirmedFor, setHsCodeConfirmedFor] = useState<string>(''); // export country when HS code was confirmed
  const [showHsSearch, setShowHsSearch] = useState(false);
  const [error, setError] = useState('');
  const [editableField, setEditableField] = useState<FieldKey | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const t = lang ? STRINGS[lang] : STRINGS['en'];
  const totalSteps = FIELD_DEFS.length;
  const reviewStep = totalSteps;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, step]);

  const startWizard = useCallback((selectedLang: Lang) => {
    setLang(selectedLang);
    const s = STRINGS[selectedLang];
    setMessages([{ role: 'ercie', text: s.startFilling }]);
    setStep(0);
  }, []);

  const currentField = step >= 0 && step < totalSteps ? FIELD_DEFS[step] : null;

  const addErcieMessage = useCallback((text: string, fieldKey?: FieldKey) => {
    setMessages((prev) => [...prev, { role: 'ercie', text, fieldKey }]);
  }, []);

  const addUserMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'user', text }]);
  }, []);

  const updateShipment = (key: FieldKey, value: string) => {
    setShipment((prev) => {
      const next = { ...prev, [key]: value };
      // Map wizard field keys to Shipment keys
      if (key === 'exportCountry') next.exportingCountry = value;
      if (key === 'destinationCountry') next.destinationCountry = value;
      if (key === 'countryOfOrigin') next.countryOfOrigin = value;
      if (key === 'buyerImporter') next.buyerImporter = value;
      if (key === 'productCategory') next.productCategory = value;
      if (key === 'productCharacteristics') next.productCharacteristics = value;
      if (key === 'endUse') next.endUse = value;
      if (key === 'supplyChainInfo') next.supplyChainInformation = value;
      if (key === 'certificates') next.certificates = value;
      if (key === 'plannedImportDate') next.plannedImportDate = value;
      return next;
    });
  };

  const getFieldValue = (key: FieldKey): string => {
    const s = shipment;
    switch (key) {
      case 'productName': return s.productName;
      case 'exportCountry': return s.exportingCountry;
      case 'hsCode': return s.hsCode;
      case 'countryOfOrigin': return s.countryOfOrigin;
      case 'destinationCountry': return s.destinationCountry;
      case 'buyerImporter': return s.buyerImporter;
      case 'productCategory': return s.productCategory;
      case 'productCharacteristics': return s.productCharacteristics;
      case 'endUse': return s.endUse;
      case 'supplyChainInfo': return s.supplyChainInformation;
      case 'certificates': return s.certificates;
      case 'plannedImportDate': return s.plannedImportDate;
    }
  };

  const handleFieldSubmit = (value: string) => {
    if (!currentField || !lang) return;
    const fieldKey = currentField.key;
    const t = STRINGS[lang];

    // Validate required fields
    if (currentField.required && !value.trim()) {
      setError(t.requiredMissing);
      return;
    }

    // Validate HS Code format
    if (fieldKey === 'hsCode' && value.trim() && !isValidHsCode(value)) {
      setError(t.hsCodeInvalid);
      return;
    }

    // Track HS Code confirmation for export country
    if (fieldKey === 'hsCode' && value.trim()) {
      setHsCodeConfirmedFor(shipment.exportingCountry);
    }

    setError('');

    // ── Country extraction from productName ──
    // When the user submits productName, try to extract export country and
    // destination country from the text so we can pre-fill and skip those steps.
    let extracted: ExtractedCountries = {};
    if (fieldKey === 'productName') {
      extracted = extractCountriesFromText(value);
    }

    // Apply the submitted field value
    updateShipment(fieldKey, value.trim());
    // Apply any extracted countries on top
    if (extracted.exportCountry) updateShipment('exportCountry', extracted.exportCountry);
    if (extracted.destinationCountry) updateShipment('destinationCountry', extracted.destinationCountry);

    addUserMessage(value.trim() || (dontKnowCount > 0 ? 'Unknown / to be confirmed' : 'Skipped'));

    // If we extracted countries, tell the user what we found
    if (extracted.exportCountry || extracted.destinationCountry) {
      const parts: string[] = [];
      if (extracted.exportCountry) parts.push(`Export country: ${extracted.exportCountry}`);
      if (extracted.destinationCountry) parts.push(`Destination: ${extracted.destinationCountry}`);
      addErcieMessage(`I picked up the following from your description — ${parts.join(', ')}. Please confirm or correct these when you reach those fields.`);
    }

    setDontKnowCount(0);
    setInputValue('');

    // Advance to the next step, skipping fields already filled by extraction
    let nextStep = step + 1;
    while (nextStep < totalSteps) {
      const nextField = FIELD_DEFS[nextStep];
      const alreadyFilled =
        (nextField.key === 'exportCountry' && !!extracted.exportCountry) ||
        (nextField.key === 'destinationCountry' && !!extracted.destinationCountry);
      if (alreadyFilled) {
        // Silently pre-fill and skip; show a confirmation message instead
        addErcieMessage(
          nextField.key === 'exportCountry'
            ? `Export country pre-filled as "${extracted.exportCountry}". You can change it in the review screen.`
            : `Destination country pre-filled as "${extracted.destinationCountry}". You can change it in the review screen.`
        );
        nextStep++;
      } else {
        break;
      }
    }

    // Add Ercie's prompt for the next un-filled field
    if (nextStep < totalSteps) {
      const nextField = FIELD_DEFS[nextStep];
      addErcieMessage(t.fieldHelp[nextField.key]);
      addErcieMessage(t.fieldAsk[nextField.key], nextField.key);
    } else {
      addErcieMessage(t.reviewIntro);
    }

    setStep(nextStep);
  };

  const handleSkip = () => {
    if (!currentField || !lang) return;
    const t = STRINGS[lang];
    if (currentField.required) {
      setError(t.requiredMissing);
      return;
    }
    setError('');
    updateShipment(currentField.key, '');
    addUserMessage(t.skip);
    setDontKnowCount(0);
    setInputValue('');

    if (step + 1 < totalSteps) {
      const nextField = FIELD_DEFS[step + 1];
      addErcieMessage(t.fieldHelp[nextField.key]);
      addErcieMessage(t.fieldAsk[nextField.key], nextField.key);
    } else {
      addErcieMessage(t.reviewIntro);
    }
    setStep(step + 1);
  };

  const handleDontKnow = () => {
    if (!currentField || !lang) return;
    const t = STRINGS[lang];

    if (dontKnowCount === 0) {
      // First "don't know" — re-ask differently
      setDontKnowCount(1);
      addErcieMessage(t.reAsk);
      addErcieMessage(t.fieldReAsk[currentField.key], currentField.key);
      return;
    }

    // Second "don't know" — mark as Unknown
    if (currentField.required) {
      setError(t.requiredMissing);
      return;
    }

    setError('');
    updateShipment(currentField.key, 'Unknown');
    addUserMessage(t.dontKnow);
    addErcieMessage(t.markedUnknown);
    setDontKnowCount(0);

    if (step + 1 < totalSteps) {
      const nextField = FIELD_DEFS[step + 1];
      addErcieMessage(t.fieldHelp[nextField.key]);
      addErcieMessage(t.fieldAsk[nextField.key], nextField.key);
    } else {
      addErcieMessage(t.reviewIntro);
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step <= 0) return;
    setStep(step - 1);
    setError('');
    setDontKnowCount(0);
    // Remove last 2-3 messages (the field ask + help)
    setMessages((prev) => {
      const next = [...prev];
      // Remove messages until we're back at the previous field
      while (next.length > 2 && next[next.length - 1].role === 'ercie') {
        next.pop();
      }
      if (next.length > 0 && next[next.length - 1].role === 'user') {
        next.pop();
      }
      return next;
    });
  };

  const handleEditField = (key: FieldKey) => {
    setEditableField(key);
    setEditingValue(getFieldValue(key));
  };

  const saveEdit = () => {
    if (!editableField) return;
    if (editableField === 'hsCode' && editingValue.trim() && !isValidHsCode(editingValue)) {
      setError(t.hsCodeInvalid);
      return;
    }
    updateShipment(editableField, editingValue.trim());
    if (editableField === 'exportCountry') {
      setHsCodeConfirmedFor('');
    }
    setEditableField(null);
    setEditingValue('');
    setError('');
  };

  const startCheck = () => {
    // Validate required fields
    for (const key of REQUIRED_FIELDS) {
      const val = getFieldValue(key);
      if (!val.trim() || val.trim() === 'Unknown') {
        setError(t.requiredMissing);
        return;
      }
    }
    // Check HS Code re-confirmation if export country changed
    if (shipment.hsCode && hsCodeConfirmedFor && hsCodeConfirmedFor !== shipment.exportingCountry) {
      setError(t.hsCodeReconfirm);
      return;
    }
    // Save shipment and proceed
    if (typeof window !== 'undefined') {
      localStorage.setItem('erc-shipment', JSON.stringify(shipment));
      localStorage.setItem('erc-shipment-lang', lang || 'en');
    }
    router.push('/check/review');
  };

  // ─── Language selection screen ──────────────────────────────────────────────
  if (step === -1) {
    return (
      <AppShell active="/check/new">
        <PageHeader
          title="New Export Risk Check"
          subtitle="交易前，風險檢查 — Check export risks before you trade."
          action={<Stepper step={1} />}
        />
        <div className="ercie-welcome content-card">
          <div className="ercie-avatar-lg"><Bot size={36} /></div>
          <h2>Ercie / 艾希</h2>
          <p className="ercie-tagline">Your export risk assistant</p>
          <div className="ercie-bubble-lg">
            <Bot size={18} />
            <p>Hi! I&apos;m Ercie. I&apos;ll guide you through a few questions about your product and trade plan. What language would you like to use?</p>
          </div>
          <div className="lang-grid">
            {LANGUAGES.map((l) => (
              <button key={l.code} className="lang-card" onClick={() => startWizard(l.code)}>
                <Globe2 size={20} />
                <strong>{l.native}</strong>
                <small>{l.label}</small>
              </button>
            ))}
          </div>
          <div className="ercie-disclaimer">
            <Info size={15} />
            <span>ERC AI generates risk information based on data you confirm. It does not provide official approval, clearance, or verify data authenticity.</span>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─── Review screen ──────────────────────────────────────────────────────────
  if (step >= reviewStep) {
    const formFields: { key: FieldKey; label: string; required: boolean }[] = FIELD_DEFS.map((f) => ({
      key: f.key, label: f.label, required: f.required,
    }));

    const hsCodeNeedsReconfirm = shipment.hsCode && hsCodeConfirmedFor && hsCodeConfirmedFor !== shipment.exportingCountry;

    return (
      <AppShell active="/check/new">
        <PageHeader
          title={t.reviewTitle}
          subtitle={t.reviewIntro}
          action={<Stepper step={2} />}
        />
        <div className="ercie-review content-card">
          <div className="ercie-review-header">
            <div className="ercie-avatar"><Bot size={22} /></div>
            <div>
              <strong>{t.ercieName}</strong>
              <p>{t.reviewModifyNote}</p>
            </div>
          </div>

          {/* Buyer note */}
          {!shipment.buyerImporter && (
            <div className="ercie-notice">
              <Info size={15} />
              <span>{t.buyerNote}</span>
            </div>
          )}

          {/* HS Code re-confirmation notice */}
          {hsCodeNeedsReconfirm && (
            <div className="ercie-warning">
              <AlertTriangle size={15} />
              <span>{t.hsCodeReconfirmPrompt}</span>
              <button className="ercie-confirm-btn" onClick={() => setHsCodeConfirmedFor(shipment.exportingCountry)}>
                <CheckCircle2 size={14} /> {t.hsCodeKeep}
              </button>
            </div>
          )}

          {/* English form */}
          <h3 className="ercie-form-title">{t.reviewEnglishForm}</h3>
          <div className="ercie-form-grid">
            {formFields.map((f) => {
              const val = getFieldValue(f.key);
              const isEditing = editableField === f.key;
              return (
                <div key={f.key} className={cx('ercie-form-row', f.required && 'ercie-form-required')}>
                  <div className="ercie-form-label">
                    {f.label}{f.required && <b>*</b>}
                    {!f.required && f.key === 'buyerImporter' && <small className="ercie-form-note"> {t.buyerNote}</small>}
                  </div>
                  {isEditing ? (
                    <div className="ercie-edit-inline">
                      {f.key === 'exportCountry' || f.key === 'destinationCountry' || f.key === 'countryOfOrigin' ? (
                        <CountrySelect
                          label=""
                          value={editingValue}
                          onChange={(v: string) => setEditingValue(v)}
                        />
                      ) : f.key === 'plannedImportDate' ? (
                        <input type="date" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="ercie-edit-input" />
                      ) : (
                        <input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="ercie-edit-input"
                        />
                      )}
                      <button className="ercie-save-btn" onClick={saveEdit}><CheckCircle2 size={14} /> {t.confirm}</button>
                      <button className="ercie-cancel-btn" onClick={() => { setEditableField(null); setError(''); }}>✕</button>
                    </div>
                  ) : (
                    <div className="ercie-form-value">
                      <strong>{val || (f.required ? '' : '—')}</strong>
                      <button className="ercie-edit-btn" onClick={() => handleEditField(f.key)}><User size={12} /> {t.editAnswer}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && <div className="form-error"><AlertTriangle size={16} />{error}</div>}

          <div className="ercie-disclaimer">
            <Info size={15} />
            <span>本報告依據您確認提供的資料產生。ERC AI does not provide official approval, clearance, or verify data authenticity.</span>
          </div>

          <div className="form-actions">
            <button className="secondary-button" onClick={() => { setStep(totalSteps - 1); setEditableField(null); }}>
              <ChevronLeft size={16} /> {t.back}
            </button>
            <PrimaryButton onClick={startCheck}>{t.startCheck}</PrimaryButton>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─── Field collection screen ────────────────────────────────────────────────
  const sources = currentField?.key === 'hsCode' ? getHsCodeSources(shipment.exportingCountry) : [];
  const hsNeedsReconfirm = currentField?.key === 'hsCode' && hsCodeConfirmedFor && hsCodeConfirmedFor !== shipment.exportingCountry && shipment.hsCode;

  return (
    <AppShell active="/check/new">
      <PageHeader
        title="New Export Risk Check"
        subtitle="交易前，風險檢查 — Check export risks before you trade."
        action={<Stepper step={1} />}
      />
      <div className="ercie-layout">
        <div className="ercie-chat content-card">
          {/* Header */}
          <div className="ercie-chat-header">
            <div className="ercie-avatar"><Bot size={20} /></div>
            <div>
              <strong>{t.ercieName}</strong>
              <small>{t.ercieTagline}</small>
            </div>
            <div className="ercie-progress">
              <span>{step + 1} / {totalSteps}</span>
              <div className="ercie-progress-bar"><div style={{ width: `${((step + 1) / totalSteps) * 100}%` }} /></div>
            </div>
          </div>

          {/* Chat messages */}
          <div className="ercie-messages" ref={scrollRef}>
            {messages.map((msg, i) => (
              <div key={i} className={cx('ercie-msg', msg.role === 'ercie' ? 'ercie-msg-bot' : 'ercie-msg-user')}>
                {msg.role === 'ercie' && <div className="ercie-avatar-sm"><Bot size={14} /></div>}
                <div className="ercie-msg-bubble">{msg.text}</div>
              </div>
            ))}

            {/* Current field guidance (already in messages, but show input here) */}
          </div>

          {/* Input area */}
          <div className="ercie-input-area">
            {error && <div className="form-error ercie-error"><AlertTriangle size={15} />{error}</div>}

            {currentField && (
              <>
                {/* HS Code re-confirmation notice */}
                {hsNeedsReconfirm && (
                  <div className="ercie-warning">
                    <AlertTriangle size={14} />
                    <span>{t.hsCodeReconfirm}</span>
                  </div>
                )}

                {/* Special notes */}
                {currentField.key === 'buyerImporter' && (
                  <div className="ercie-notice"><Info size={13} /><span>{t.buyerNote}</span></div>
                )}
                {currentField.key === 'countryOfOrigin' && (
                  <div className="ercie-notice"><Info size={13} /><span>{t.originNote}</span></div>
                )}

                {/* Input control */}
                {currentField.type === 'country' ? (
                  <CountrySelect
                    label=""
                    value={inputValue || getFieldValue(currentField.key)}
                    onChange={(v: string) => { setInputValue(v); setError(''); }}
                  />
                ) : currentField.type === 'date' ? (
                  <input
                    type="date"
                    value={inputValue || getFieldValue(currentField.key)}
                    onChange={(e) => { setInputValue(e.target.value); setError(''); }}
                    className="ercie-text-input"
                  />
                ) : currentField.type === 'textarea' ? (
                  <textarea
                    value={inputValue}
                    onChange={(e) => { setInputValue(e.target.value); setError(''); }}
                    placeholder="..."
                    rows={3}
                    className="ercie-text-input"
                  />
                ) : currentField.type === 'hscode' ? (
                  <div className="ercie-hscode-input">
                    <input
                      value={inputValue}
                      onChange={(e) => { setInputValue(e.target.value); setError(''); }}
                      placeholder="6 or 8 digits"
                      className="ercie-text-input"
                      inputMode="numeric"
                    />
                    <button type="button" className="ercie-search-btn" onClick={() => setShowHsSearch(true)}>
                      <Search size={14} /> {t.hsCodeLookup}
                    </button>
                  </div>
                ) : (
                  <input
                    value={inputValue}
                    onChange={(e) => { setInputValue(e.target.value); setError(''); }}
                    placeholder="..."
                    className="ercie-text-input"
                  />
                )}

                {/* Action buttons */}
                <div className="ercie-actions">
                  {step > 0 && (
                    <button className="ercie-text-btn" onClick={handleBack}>
                      <ChevronLeft size={14} /> {t.back}
                    </button>
                  )}
                  {!currentField.required && (
                    <button className="ercie-text-btn" onClick={handleSkip}>
                      <SkipForward size={14} /> {t.skip}
                    </button>
                  )}
                  <button className="ercie-text-btn" onClick={handleDontKnow}>
                    {t.dontKnow}
                  </button>
                  <button
                    className="primary-button ercie-submit-btn"
                    onClick={() => handleFieldSubmit(inputValue || getFieldValue(currentField.key))}
                  >
                    {t.next} <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Side panel: checks overview */}
        <aside className="checks-panel content-card ercie-side-panel">
          <h2>Regulatory checks to run</h2>
          <p>ERC AI will automatically identify applicable regulations for your product and destination.</p>
          <div className="ercie-checks-list">
            {FIELD_DEFS.filter((f) => f.required).map((f) => {
              const val = getFieldValue(f.key);
              const done = val.trim() && val.trim() !== 'Unknown';
              return (
                <div key={f.key} className={cx('ercie-check-item', done && 'ercie-check-done')}>
                  {done ? <CheckCircle2 size={16} /> : <div className="ercie-check-pending" />}
                  <span>{f.label}{f.required && <b>*</b>}</span>
                </div>
              );
            })}
          </div>
          <div className="ercie-upload-area">
            <UploadCloud size={24} />
            <strong>Upload catalog / documents</strong>
            <small>{t.uploadComingSoon}</small>
          </div>
        </aside>
      </div>

      {/* HS Code search modal */}
      {showHsSearch && (
        <HsCodeSearchModal
          sources={sources}
          title={t.hsCodeSearchTitle}
          noSourceText={t.hsCodeNoSource}
          noSourceHelp={t.hsCodeNoSourceHelp}
          exportCountry={shipment.exportingCountry}
          onClose={() => setShowHsSearch(false)}
        />
      )}
    </AppShell>
  );
}

// ─── HS Code Search Modal ────────────────────────────────────────────────────

function HsCodeSearchModal({
  sources, title, noSourceText, noSourceHelp, exportCountry, onClose,
}: {
  sources: HsCodeSource[];
  title: string;
  noSourceText: string;
  noSourceHelp: string;
  exportCountry: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal ercie-hs-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="ercie-hs-header">
          <Search size={20} />
          <h2>{title}</h2>
        </div>
        <p className="ercie-hs-country">Export country: <strong>{exportCountry}</strong></p>
        {sources.length > 0 ? (
          <div className="ercie-hs-sources">
            {sources.map((src) => (
              <a
                key={src.url}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ercie-hs-source-link"
              >
                <div>
                  <strong>{src.label}</strong>
                  {src.note && <small>{src.note}</small>}
                </div>
                <ExternalLink size={16} />
              </a>
            ))}
            <p className="ercie-hs-help">
              Links open in a new tab. Your form and conversation are preserved when you return.
            </p>
          </div>
        ) : (
          <div className="ercie-hs-no-source">
            <AlertTriangle size={24} />
            <strong>{noSourceText}</strong>
            <p>{noSourceHelp}</p>
          </div>
        )}
        <button className="primary-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
