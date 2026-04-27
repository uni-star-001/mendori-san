/**
 * @OnlyCurrentDoc
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function saveScheduleSettings(jsonStr) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('scheduleSettings', jsonStr);
}

function loadScheduleSettings() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('scheduleSettings');
}

// ============================================
// Googleフォームを自動生成する関数
// FormApp = GoogleフォームをGASで操作する仕組み
// ============================================
function createInterviewForm(jsonStr) {
  const settings = JSON.parse(jsonStr);
  const props = PropertiesService.getScriptProperties();

  // フォームを新規作成
  const form = FormApp.create('個人面談 希望日程アンケート');
  form.setDescription(
    '面談の希望日程をお知らせください。\n' +
    '変更がある場合は締め切り期日内に再度ご回答・送信ください。'
  );
  form.setConfirmationMessage(
    'ご回答ありがとうございました。希望日時に変更がある場合は、締め切り期日内に再度ご回答・送信ください。'
  );
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);

  // ページ1：基本情報
  form.addSectionHeaderItem()
    .setTitle('お子さんの情報を入力してください');

  // 学年（先生が設定した学年数分）
  const gradeChoices = [];
  for (let i = 1; i <= settings.numGrades; i++) {
    gradeChoices.push(String(i));
  }
  const gradeItem = form.addMultipleChoiceItem();
  gradeItem.setTitle('学年').setRequired(true)
    .setChoiceValues(gradeChoices);

  // 組（1〜クラス数）
  const classChoices = [];
  for (let i = 1; i <= settings.numClasses; i++) {
    classChoices.push(String(i));
  }
  const classItem = form.addMultipleChoiceItem();
  classItem.setTitle('組').setRequired(true)
    .setChoiceValues(classChoices);

  // 番号（1〜40）
  const numChoices = [];
  for (let i = 1; i <= settings.maxNumber; i++) numChoices.push(String(i));
  const numItem = form.addMultipleChoiceItem();
  numItem.setTitle('番号').setRequired(true)
    .setChoiceValues(numChoices);

  // 姓・名
  form.addTextItem().setTitle('お子さんの姓（例：田中）').setRequired(true);
  form.addTextItem().setTitle('お子さんの名（例：花子）').setRequired(true);

  // 兄弟姉妹姉妹情報
  const siblingItem = form.addTextItem();
  siblingItem.setTitle('兄弟姉妹姉妹と同日希望の方（任意）');
  siblingItem.setHelpText(
    '記入例：1人の場合 → 1-2-3 田中太郎　／　2人の場合 → 1-2-3 田中太郎, 3-1-5 田中花子\n' +
    '※「学年-組-番号 氏名」の形式で入力してください\n' +
    '※数字は半角で入力してください'
  );

  // ページ2：希望日程（セクション区切りは兄弟姉妹姉妹の次の1回だけ）
  form.addPageBreakItem().setTitle('都合の悪い日時をお知らせください');

  // 日付ごとにチェックボックスを追加（セクション区切りなし）
  // タイトルに日付を含めて1項目にまとめる
  // → 保護者が見やすく、データ処理時も日付ごとの列として取得できる
  settings.dates.forEach(d => {
    const badTimesItem = form.addCheckboxItem();
    badTimesItem.setTitle(
      formatDateJa(d.date) + ' の都合の悪い時間（該当するものをすべて選択）'
    );
    badTimesItem.setHelpText('チェックなし＝この日は全コマOKとして扱います');

    const choices = [];
    const startMin = timeToMin(d.start);
    const endMin   = timeToMin(d.end);
    for (let m = startMin; m < endMin; m += settings.slotDuration) {
      choices.push(minToTime(m) + '〜' + minToTime(m + settings.slotDuration));
    }
    badTimesItem.setChoiceValues(choices);
  });

  // 面談で話題にしたいこと（セクション区切りなしで続けて表示）
  form.addParagraphTextItem()
    .setTitle('面談で話題にしたいことがあればご記入ください（任意）');

  // 送信案内（説明文のみの項目）
  // addSectionHeaderItem() = 説明テキストを表示するだけの項目
  form.addSectionHeaderItem()
    .setTitle('入力が終わったら送信ボタンを押してください');

  // フォームIDとURLを保存
  const formId  = form.getId();
  const formUrl = form.getPublishedUrl();
  props.setProperty('formId',  formId);
  props.setProperty('formUrl', formUrl);
  props.setProperty('formEditUrl', form.getEditUrl());

  // フォームの回答をスプレッドシートに連携
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // publishedUrl（保護者用）と editUrl（管理用）を両方返す
  // index.htmlでは result.publishedUrl / result.editUrl として受け取る
  return JSON.stringify({
    publishedUrl: formUrl,
    editUrl:      form.getEditUrl()
  });
}

// "HH:MM" → 分に変換
function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// 分 → "HH:MM" に変換
function minToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

// "YYYY-MM-DD" → "6月10日（火）"
function formatDateJa(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const weekdays = ['日','月','火','水','木','金','土'];
  return `${date.getMonth()+1}月${date.getDate()}日（${weekdays[date.getDay()]}）`;
}

// ============================================
// 画面2：対象範囲・クラス人数設定を保存
// ============================================
function saveScreen2Settings(jsonStr) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('screen2Settings', jsonStr);
}

// ============================================
// 画面2：フォーム回答データを読み込む
// 元データ（フォームの回答シート）は読み取り専用
// 作業シートに整理済みデータを書き込む
// ============================================
function loadFormResponses() {
  const props  = PropertiesService.getScriptProperties();
  const s2str  = props.getProperty('screen2Settings');
  const s1str  = props.getProperty('scheduleSettings');

  if (!s2str) return JSON.stringify({ error: '対象範囲が設定されていません' });
  if (!s1str) return JSON.stringify({ error: '画面1の設定が見つかりません' });

  const s2 = JSON.parse(s2str);
  const s1 = JSON.parse(s1str);

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // フォームの回答シートを取得（フォーム連携で自動生成されるシート）
  // シート名は「フォームの回答 1」が標準
  const responseSheet = findResponseSheet(ss);
  if (!responseSheet) {
    return JSON.stringify({ error: 'フォームの回答シートが見つかりません。フォームへの回答がまだない可能性があります。' });
  }

  // 回答データを取得（1行目はヘッダー）
  const allData = responseSheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return JSON.stringify({ error: 'フォームの回答がまだありません。' });
  }

  const headers = allData[0];
  const rows    = allData.slice(1);

  // ヘッダーから各列のインデックスを取得
  // フォームの列順：タイムスタンプ・学年・組・番号・姓・名・兄弟姉妹・都合の悪い時間×日数・面談で話題に
  const colIdx = {
    timestamp: 0,
    grade:     findColIndex(headers, '学年'),
    klass:     findColIndex(headers, '組'),
    number:    findColIndex(headers, '番号'),
    lastName:  findColIndex(headers, '姓'),
    firstName: findColIndex(headers, '名'),
    sibling:   findColIndex(headers, '兄弟姉妹姉妹'),
    topic:     findColIndex(headers, '話題'),
  };

  // 対象範囲でフィルタリング
  const targetGrade = s2.targetGrade; // null = 全体
  const targetClass = s2.targetClass; // null = 全体
  const classSizes  = s2.classSizes;  // { "1-1": 35, "1-2": 34, ... }

  // 重複回答を処理（同一人物の最新タイムスタンプを有効化）
  // キー：学年-組-番号
  const latestMap = {};
  rows.forEach(row => {
    const grade  = String(row[colIdx.grade]  || '').trim();
    const klass  = String(row[colIdx.klass]  || '').trim();
    const number = String(row[colIdx.number] || '').trim();
    if (!grade || !klass || !number) return;

    // 対象範囲フィルター
    if (targetGrade && grade !== String(targetGrade)) return;
    if (targetClass && klass !== String(targetClass)) return;

    const key = `${grade}-${klass}-${number}`;
    const ts  = new Date(row[colIdx.timestamp]).getTime();

    if (!latestMap[key] || ts > latestMap[key].ts) {
      latestMap[key] = { ts, row };
    }
  });

  // 名簿生成（番号の連番から未回答者を検出）
  const roster = buildRoster(s1, s2);

  // 各生徒の回答状況を整理
  const students = roster.map(student => {
    const key     = `${student.grade}-${student.klass}-${student.number}`;
    const entry   = latestMap[key];

    if (!entry) {
      return {
        ...student,
        status:   'unanswered', // 未回答
        sibling:  '',
        badTimes: [],
        memo:     '',
        manualFlag: false,
        flags:    [],
      };
    }

    const row      = entry.row;
    const lastName = String(row[colIdx.lastName]  || '').trim();
    const firstName= String(row[colIdx.firstName] || '').trim();
    const sibling  = colIdx.sibling >= 0 ? String(row[colIdx.sibling] || '').trim() : '';
    const topic    = colIdx.topic   >= 0 ? String(row[colIdx.topic]   || '').trim() : '';

    // 都合の悪い時間を収集（日付ごとの列）
    // buildBadTimeColNameでフォームのヘッダー名と完全一致させる
    const badTimes = [];
    s1.dates.forEach(d => {
      const colName = buildBadTimeColName(d.date);
      const idx = findColIndex(headers, colName);
      if (idx >= 0 && row[idx]) {
        const times = String(row[idx]).split(',').map(t => t.trim()).filter(Boolean);
        badTimes.push({ date: d.date, times });
      }
    });

    // 全コマNG検出
    const flags = [];
    const totalSlots = s1.dates.reduce((sum, d) => {
      const start = timeToMinGs(d.start);
      const end   = timeToMinGs(d.end);
      return sum + Math.floor((end - start) / s1.slotDuration);
    }, 0);
    const ngCount = badTimes.reduce((sum, bt) => sum + bt.times.length, 0);
    if (ngCount >= totalSlots) flags.push('allNG');

    // 兄弟姉妹情報チェック
    if (sibling) flags.push('hasSibling');

    // 氏名スペースチェック
    const fullName = lastName + firstName;
    if (/\s/.test(fullName)) flags.push('nameSpace');

    return {
      ...student,
      lastName,
      firstName,
      status:     'answered', // 回答済み
      sibling,
      topic,
      badTimes,
      memo:       '',
      manualFlag: false,
      flags,
    };
  });

  // 作業シートに保存
  saveWorkSheet(ss, students);

  // 集計
  const summary = {
    total:      students.length,
    answered:   students.filter(s => s.status === 'answered').length,
    unanswered: students.filter(s => s.status === 'unanswered').length,
    flagged:    students.filter(s => s.flags && s.flags.length > 0).length,
  };

  return JSON.stringify({ summary, students });
}

// ============================================
// 画面2：データを再読み込み（作業シートをリセット）
// ============================================
function reloadFormResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 作業シートを削除して再作成
  const workSheet = ss.getSheetByName('作業データ（編集不要）');
  if (workSheet) ss.deleteSheet(workSheet);
  // 再度読み込み
  return loadFormResponses();
}

// ============================================
// 画面2：メモ・手動フラグ・未回答処理を保存
// ============================================
function saveStudentData(jsonStr) {
  const data  = JSON.parse(jsonStr);
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('作業データ（編集不要）');
  if (!sheet) return false;

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return false;

  const headers = allData[0];
  const memoIdx       = headers.indexOf('メモ');
  const manualFlagIdx = headers.indexOf('手動指定フラグ');
  const treatmentIdx  = headers.indexOf('未回答処理');
  const flagRedIdx    = headers.indexOf('赤フラグ');

  for (let i = 1; i < allData.length; i++) {
    const key = `${allData[i][0]}-${allData[i][1]}-${allData[i][2]}`;
    if (key !== data.key) continue;

    // 送られてきた項目だけ更新する（他項目を消さない）
    if (memoIdx >= 0 && Object.prototype.hasOwnProperty.call(data, 'memo')) {
      sheet.getRange(i + 1, memoIdx + 1).setValue(data.memo ?? '');
    }
    if (manualFlagIdx >= 0 && Object.prototype.hasOwnProperty.call(data, 'manualFlag')) {
      sheet.getRange(i + 1, manualFlagIdx + 1).setValue(!!data.manualFlag);
    }
    if (treatmentIdx >= 0 && Object.prototype.hasOwnProperty.call(data, 'treatment')) {
      sheet.getRange(i + 1, treatmentIdx + 1).setValue(data.treatment ?? '');
    }
    if (flagRedIdx >= 0 && Object.prototype.hasOwnProperty.call(data, 'flagRed')) {
      sheet.getRange(i + 1, flagRedIdx + 1).setValue(!!data.flagRed);
    }

    return true;
  }

  return false;
}

// ============================================
// 画面2：未回答者処理を一括保存（allNoneBtn用）
// 個別にsaveStudentDataを呼ぶと並列通信になるため
// まとめて1回のAPI呼び出しで処理する
// ============================================
function saveAllTreatments(jsonStr) {
  const keys  = JSON.parse(jsonStr);
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('作業データ（編集不要）');
  if (!sheet) return false;

  const allData    = sheet.getDataRange().getValues();
  const headers    = allData[0];
  const treatmentIdx = headers.indexOf('未回答処理');
  if (treatmentIdx < 0) return false;

  // キーをSetに変換して高速検索
  const keySet = new Set(keys);

  // 一括で更新する値を準備
  const updates = [];
  for (let i = 1; i < allData.length; i++) {
    const key = allData[i][0] + '-' + allData[i][1] + '-' + allData[i][2];
    if (keySet.has(key)) {
      updates.push({ row: i + 1, col: treatmentIdx + 1, value: 'none' });
    }
  }

  // まとめて書き込み
  updates.forEach(u => {
    sheet.getRange(u.row, u.col).setValue(u.value);
  });

  return true;
}

// ============================================
// ヘルパー関数
// ============================================

// フォームの回答シートを検索
// PropertiesServiceに保存したformIdと照合して正しいシートを返す
function findResponseSheet(ss) {
  const props  = PropertiesService.getScriptProperties();
  const formId = props.getProperty('formId');

  // formIdがある場合：そのフォームに連携したシートを特定
  if (formId) {
    try {
      const form = FormApp.openById(formId);
      const destId = form.getDestinationId();
      if (destId && destId === ss.getId()) {
        // このスプレッドシートに連携されている
        // フォームのタイトルと一致するシートを探す
        const sheets = ss.getSheets();
        // 最新のフォーム回答シートを取得（最後に見つかったもの = 最新）
        let target = null;
        for (const sheet of sheets) {
          const name = sheet.getName();
          if (name.includes('フォームの回答') || name.includes('Form Responses')) {
            target = sheet;
          }
        }
        if (target) return target;
      }
    } catch(e) {
      Logger.log('フォームID照合エラー: ' + e.message);
    }
  }

  // フォールバック：フォーム回答シートを名前で検索（最後に見つかったもの）
  const sheets = ss.getSheets();
  let target = null;
  for (const sheet of sheets) {
    const name = sheet.getName();
    if (name.includes('フォームの回答') || name.includes('Form Responses')) {
      target = sheet;
    }
  }
  return target;
}

// ヘッダー名からインデックスを取得
function findColIndex(headers, name) {
  return headers.findIndex(h => String(h).includes(name));
}


// ============================================
// 名簿機能：名簿シートからデータを読み込む
// スプレッドシートの「名簿」シートに
// 学年・組・番号・姓・名の列を用意してもらう
// ============================================
function loadRosterSheet(ss) {
  const sheet = ss.getSheetByName('名簿');
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  const headers = data[0].map(h => String(h).trim());
  const gradeIdx  = headers.findIndex(h => h.includes('学年'));
  const klassIdx  = headers.findIndex(h => h === '組' || h.includes('クラス'));
  const numberIdx = headers.findIndex(h => h.includes('番号') || h === '番');
  const lastIdx   = headers.findIndex(h => h.includes('姓') || h.includes('苗字'));
  const firstIdx  = headers.findIndex(h => h.includes('名') && !h.includes('苗字') && !h.includes('姓'));

  if (gradeIdx < 0 || klassIdx < 0 || numberIdx < 0) return null;

  const roster = {};
  data.slice(1).forEach(row => {
    const grade  = String(row[gradeIdx]  || '').trim();
    const klass  = String(row[klassIdx]  || '').trim();
    const number = String(row[numberIdx] || '').trim();
    if (!grade || !klass || !number) return;

    const key = grade + '-' + klass + '-' + number;
    roster[key] = {
      grade, klass, number,
      lastName:  lastIdx  >= 0 ? String(row[lastIdx]  || '').trim() : '',
      firstName: firstIdx >= 0 ? String(row[firstIdx] || '').trim() : '',
    };
  });

  return roster;
}

// ============================================
// 名簿機能：名簿シートの存在確認
// 画面2で名簿が使えるか確認するために使う
// ============================================
function checkRosterSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('名簿');
  if (!sheet) return JSON.stringify({ exists: false });

  const data = sheet.getDataRange().getValues();
  return JSON.stringify({
    exists: true,
    count:  Math.max(0, data.length - 1), // ヘッダーを除いた行数
  });
}

// 名簿を生成
// 名簿シートがあればそちらを優先、なければ連番で生成
function buildRoster(s1, s2) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterMap  = loadRosterSheet(ss); // 名簿シートを読み込む
  const targetGrade = s2.targetGrade;
  const targetClass = s2.targetClass;

  // 名簿シートがある場合：名簿データを使う
  if (rosterMap) {
    const roster = [];
    Object.values(rosterMap).forEach(student => {
      if (targetGrade && student.grade !== String(targetGrade)) return;
      if (targetClass && student.klass !== String(targetClass)) return;
      roster.push(student);
    });
    // 学年・組・番号順にソート
    roster.sort((a, b) => {
      if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
      if (a.klass !== b.klass) return parseInt(a.klass) - parseInt(b.klass);
      return parseInt(a.number) - parseInt(b.number);
    });
    return roster;
  }

  // 名簿シートが必須のため、名簿なしはエラーとする
  // （画面1で名簿チェック済みのため、ここに来る場合は異常系）
  throw new Error('名簿シートが見つかりません。画面1から操作をやり直してください。');
}

// 作業シートにデータを保存（一括書き込みで高速化）
// appendRowを繰り返すと1行ずつAPI通信が発生して遅くなる
// setValues一括書き込みなら1回の通信で完了する
function saveWorkSheet(ss, students) {
  let sheet = ss.getSheetByName('作業データ（編集不要）');
  if (sheet) {
    sheet.clearContents();
  } else {
    sheet = ss.insertSheet('作業データ（編集不要）');
  }

  const headers = [
    '学年','組','番号','姓','名','状態','兄弟姉妹情報','話題',
    'メモ','手動指定フラグ','未回答処理','フラグ','赤フラグ'
  ];

  const rows = students.map(s => [
    s.grade, s.klass, s.number,
    s.lastName, s.firstName,
    s.status,
    s.sibling || '',
    s.topic || '',
    s.memo || '',
    s.manualFlag || false,
    s.treatment || '',
    (s.flags || []).join(','),
    !!s.flagRed,
  ]);

  const allData = [headers, ...rows];
  sheet.getRange(1, 1, allData.length, headers.length).setValues(allData);
}

// GAS用：日付フォーマット（フォームのヘッダーと完全一致させる）
// フォーム生成時のformatDateJaと同じ出力にする
// 例：「4月21日（火）」
function formatDateJaGs(dateStr) {
  const date     = new Date(dateStr + 'T00:00:00');
  const weekdays = ['日','月','火','水','木','金','土'];
  const month    = date.getMonth() + 1;
  const day      = date.getDate();
  const weekday  = weekdays[date.getDay()];
  return month + '月' + day + '日（' + weekday + '）';
}

// フォームのヘッダー名を生成する関数（照合用）
// loadFormResponses内でこれを使って列を特定する
function buildBadTimeColName(dateStr) {
  return formatDateJaGs(dateStr) + ' の都合の悪い時間（該当するものをすべて選択）';
}

// GAS用：時刻を分に変換
function timeToMinGs(t) {
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

// ============================================
// テスト用：フォーム回答シートにテストデータを挿入
// GASエディタから直接実行する（画面からは呼ばない）
// テスト完了後にこの関数ごと削除してください
//
// 【テスト設定】
// - 面談日：6月15日・16日・18日・19日・22日
// - 時間：15:30〜17:00（月・火・月）/ 13:30〜16:30（木・金）
// - 6学年×2クラス×25名（計300名）/ 未回答10名 / 重複回答1件
// - 兄弟姉妹グループ：各グループは同じ姓
// - 全コマNGテスト：1年1組25番
// - 共通コマなしテスト：1年1組8番 ↔ 3年2組14番
// - 重複回答テスト：1年1組1番が2回送信（最新が有効）
// ============================================
function insertTestData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('フォームの回答 44');
  if (!sheet) {
    Logger.log('ERROR: 「フォームの回答 44」が見つかりません');
    return;
  }
  Logger.log('書き込み先シート: ' + sheet.getName());
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('ヘッダー: ' + headers.join(', '));

  const testRows = [
  {
    timestamp: '2026/05/20 09:00:00',
    grade: '1', klass: '1', number: '1',
    lastName: '高橋', firstName: 'AGFT',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:03:00',
    grade: '1', klass: '1', number: '2',
    lastName: '山本', firstName: 'TSLL',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:06:00',
    grade: '1', klass: '1', number: '3',
    lastName: '田中', firstName: 'CWQV',
    sibling: `1-2-5 田中WWKL`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 09:09:00',
    grade: '1', klass: '1', number: '4',
    lastName: '伊藤', firstName: 'JFGY',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:12:00',
    grade: '1', klass: '1', number: '5',
    lastName: '佐藤', firstName: 'VKBX',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 09:15:00',
    grade: '1', klass: '1', number: '6',
    lastName: '渡辺', firstName: 'NCBC',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 14:30〜14:45, 16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:18:00',
    grade: '1', klass: '1', number: '7',
    lastName: '斎藤', firstName: 'UUJH',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 09:21:00',
    grade: '1', klass: '1', number: '8',
    lastName: '佐藤', firstName: 'EJDY',
    sibling: `3-2-14 佐藤YYQM`,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30, 16:30〜16:45, 16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30, 16:30〜16:45, 16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 13:45〜14:00, 14:00〜14:15, 14:15〜14:30, 14:30〜14:45, 14:45〜15:00, 15:00〜15:15, 15:15〜15:30, 15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 13:45〜14:00, 14:00〜14:15, 14:15〜14:30, 14:30〜14:45, 14:45〜15:00, 15:00〜15:15, 15:15〜15:30, 15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30, 16:30〜16:45, 16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 09:24:00',
    grade: '1', klass: '1', number: '9',
    lastName: '山田', firstName: 'XVHB',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:27:00',
    grade: '1', klass: '1', number: '10',
    lastName: '清水', firstName: 'WLFN',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:15〜15:30, 13:45〜14:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:30:00',
    grade: '1', klass: '1', number: '11',
    lastName: '木村', firstName: 'PQAS',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:33:00',
    grade: '1', klass: '1', number: '12',
    lastName: '鈴木', firstName: 'TXPF',
    sibling: `3-1-4 鈴木BTVC, 5-2-19 鈴木ENDE`,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:36:00',
    grade: '1', klass: '1', number: '13',
    lastName: '中村', firstName: 'WBVW',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 15:00〜15:15, 13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:39:00',
    grade: '1', klass: '1', number: '14',
    lastName: '佐々木', firstName: 'GULL',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:42:00',
    grade: '1', klass: '1', number: '15',
    lastName: '吉田', firstName: 'BQNW',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:45:00',
    grade: '1', klass: '1', number: '16',
    lastName: '中村', firstName: 'PABR',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:48:00',
    grade: '1', klass: '1', number: '17',
    lastName: '松本', firstName: 'QPCN',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 09:51:00',
    grade: '1', klass: '1', number: '18',
    lastName: '渡辺', firstName: 'GXTD',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:15〜15:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 09:54:00',
    grade: '1', klass: '1', number: '19',
    lastName: '山口', firstName: 'VBJD',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:00:00',
    grade: '1', klass: '1', number: '21',
    lastName: '山口', firstName: 'ATHY',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:03:00',
    grade: '1', klass: '1', number: '22',
    lastName: '松本', firstName: 'JVWF',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15, 15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 10:06:00',
    grade: '1', klass: '1', number: '23',
    lastName: '小林', firstName: 'EZGC',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:09:00',
    grade: '1', klass: '1', number: '24',
    lastName: '山口', firstName: 'BRHH',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 10:12:00',
    grade: '1', klass: '1', number: '25',
    lastName: '伊藤', firstName: 'QHPA',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30, 16:30〜16:45, 16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30, 16:30〜16:45, 16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 13:45〜14:00, 14:00〜14:15, 14:15〜14:30, 14:30〜14:45, 14:45〜15:00, 15:00〜15:15, 15:15〜15:30, 15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 13:45〜14:00, 14:00〜14:15, 14:15〜14:30, 14:30〜14:45, 14:45〜15:00, 15:00〜15:15, 15:15〜15:30, 15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30, 16:30〜16:45, 16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 10:15:00',
    grade: '1', klass: '2', number: '1',
    lastName: '山本', firstName: 'LPRM',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:18:00',
    grade: '1', klass: '2', number: '2',
    lastName: '渡辺', firstName: 'AFMW',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 15:00〜15:15, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:21:00',
    grade: '1', klass: '2', number: '3',
    lastName: '中村', firstName: 'EYNB',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:15〜15:30, 14:00〜14:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 10:24:00',
    grade: '1', klass: '2', number: '4',
    lastName: '中村', firstName: 'WGUM',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:27:00',
    grade: '1', klass: '2', number: '5',
    lastName: '田中', firstName: 'WWKL',
    sibling: `1-1-3 田中CWQV`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 13:30〜13:45, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 13:30〜13:45, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:30:00',
    grade: '1', klass: '2', number: '6',
    lastName: '加藤', firstName: 'UWYL',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 16:00〜16:15, 15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 15:45〜16:00, 15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:33:00',
    grade: '1', klass: '2', number: '7',
    lastName: '木村', firstName: 'PARD',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 16:15〜16:30, 15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 10:36:00',
    grade: '1', klass: '2', number: '8',
    lastName: '林', firstName: 'ANZJ',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:39:00',
    grade: '1', klass: '2', number: '9',
    lastName: '林', firstName: 'SPFS',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:42:00',
    grade: '1', klass: '2', number: '10',
    lastName: '高橋', firstName: 'SYKT',
    sibling: `2-2-3 高橋JLJN`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:45:00',
    grade: '1', klass: '2', number: '11',
    lastName: '田中', firstName: 'WVCZ',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 10:48:00',
    grade: '1', klass: '2', number: '12',
    lastName: '木村', firstName: 'GWVC',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:51:00',
    grade: '1', klass: '2', number: '13',
    lastName: '吉田', firstName: 'GQXP',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 14:15〜14:30, 15:15〜15:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 13:30〜13:45, 13:45〜14:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:54:00',
    grade: '1', klass: '2', number: '14',
    lastName: '中村', firstName: 'HPMN',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 10:57:00',
    grade: '1', klass: '2', number: '15',
    lastName: '斎藤', firstName: 'YSET',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:00:00',
    grade: '1', klass: '2', number: '16',
    lastName: '渡辺', firstName: 'GZPS',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:03:00',
    grade: '1', klass: '2', number: '17',
    lastName: '渡辺', firstName: 'VKBR',
    sibling: `2-1-14 渡辺UKXH, 4-1-8 渡辺QLPB, 6-2-5 渡辺ZCUR`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:06:00',
    grade: '1', klass: '2', number: '18',
    lastName: '鈴木', firstName: 'DEBA',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:09:00',
    grade: '1', klass: '2', number: '19',
    lastName: '中村', firstName: 'YURR',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 11:15:00',
    grade: '1', klass: '2', number: '21',
    lastName: '小林', firstName: 'PUEN',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 16:15〜16:30, 13:45〜14:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 11:18:00',
    grade: '1', klass: '2', number: '22',
    lastName: '林', firstName: 'GYVP',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 13:30〜13:45, 14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 11:21:00',
    grade: '1', klass: '2', number: '23',
    lastName: '佐藤', firstName: 'EPYL',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 11:24:00',
    grade: '1', klass: '2', number: '24',
    lastName: '高橋', firstName: 'MCVM',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:27:00',
    grade: '1', klass: '2', number: '25',
    lastName: '小林', firstName: 'UWJU',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 15:15〜15:30, 15:30〜15:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 11:30:00',
    grade: '2', klass: '1', number: '1',
    lastName: '中村', firstName: 'PFUB',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 11:33:00',
    grade: '2', klass: '1', number: '2',
    lastName: '高橋', firstName: 'NLTK',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 11:36:00',
    grade: '2', klass: '1', number: '3',
    lastName: '林', firstName: 'WABR',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:39:00',
    grade: '2', klass: '1', number: '4',
    lastName: '山田', firstName: 'JDNP',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 16:00〜16:15, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 11:42:00',
    grade: '2', klass: '1', number: '5',
    lastName: '伊藤', firstName: 'XMGP',
    sibling: `4-1-18 伊藤FPPZ`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 11:45:00',
    grade: '2', klass: '1', number: '6',
    lastName: '田中', firstName: 'ZRGP',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:48:00',
    grade: '2', klass: '1', number: '7',
    lastName: '山本', firstName: 'RXRH',
    sibling: `2-2-12 山本NZNX`,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:51:00',
    grade: '2', klass: '1', number: '8',
    lastName: '小林', firstName: 'XYZH',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 14:45〜15:00, 13:45〜14:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:54:00',
    grade: '2', klass: '1', number: '9',
    lastName: '中村', firstName: 'CJTG',
    sibling: `4-2-13 中村BAZC, 6-1-2 中村FNKJ`,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 14:30〜14:45, 15:00〜15:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:57:00',
    grade: '2', klass: '1', number: '10',
    lastName: '斎藤', firstName: 'LTDK',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 14:15〜14:30, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:00:00',
    grade: '2', klass: '1', number: '11',
    lastName: '山田', firstName: 'PZJK',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 16:00〜16:15, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:03:00',
    grade: '2', klass: '1', number: '12',
    lastName: '中村', firstName: 'ZUEV',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:06:00',
    grade: '2', klass: '1', number: '13',
    lastName: '斎藤', firstName: 'GERA',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:09:00',
    grade: '2', klass: '1', number: '14',
    lastName: '渡辺', firstName: 'UKXH',
    sibling: `1-2-17 渡辺VKBR, 4-1-8 渡辺QLPB, 6-2-5 渡辺ZCUR`,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 14:15〜14:30, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 12:12:00',
    grade: '2', klass: '1', number: '15',
    lastName: '田中', firstName: 'BMKS',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 12:15:00',
    grade: '2', klass: '1', number: '16',
    lastName: '清水', firstName: 'HNLV',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 16:15〜16:30, 13:45〜14:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 12:18:00',
    grade: '2', klass: '1', number: '17',
    lastName: '山田', firstName: 'YSMC',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15, 13:45〜14:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 13:30〜13:45, 14:30〜14:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 12:21:00',
    grade: '2', klass: '1', number: '18',
    lastName: '清水', firstName: 'FRFC',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 14:00〜14:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:24:00',
    grade: '2', klass: '1', number: '19',
    lastName: '吉田', firstName: 'JEDR',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 15:15〜15:30, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:30:00',
    grade: '2', klass: '1', number: '21',
    lastName: '清水', firstName: 'CLGS',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:33:00',
    grade: '2', klass: '1', number: '22',
    lastName: '小林', firstName: 'GCML',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 12:36:00',
    grade: '2', klass: '1', number: '23',
    lastName: '木村', firstName: 'LKRG',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:39:00',
    grade: '2', klass: '1', number: '24',
    lastName: '佐々木', firstName: 'NKHJ',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:42:00',
    grade: '2', klass: '1', number: '25',
    lastName: '山本', firstName: 'EDUB',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15, 14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:45:00',
    grade: '2', klass: '2', number: '1',
    lastName: '加藤', firstName: 'VQJB',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 12:48:00',
    grade: '2', klass: '2', number: '2',
    lastName: '斎藤', firstName: 'YTAX',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 12:51:00',
    grade: '2', klass: '2', number: '3',
    lastName: '高橋', firstName: 'JLJN',
    sibling: `1-2-10 高橋SYKT`,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 16:15〜16:30, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 12:54:00',
    grade: '2', klass: '2', number: '4',
    lastName: '吉田', firstName: 'SBRJ',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 12:57:00',
    grade: '2', klass: '2', number: '5',
    lastName: '佐々木', firstName: 'DTCP',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 14:45〜15:00, 13:30〜13:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 13:00:00',
    grade: '2', klass: '2', number: '6',
    lastName: '渡辺', firstName: 'DHUN',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:03:00',
    grade: '2', klass: '2', number: '7',
    lastName: '松本', firstName: 'BJTZ',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 14:30〜14:45, 15:00〜15:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 13:06:00',
    grade: '2', klass: '2', number: '8',
    lastName: '渡辺', firstName: 'DGRW',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:09:00',
    grade: '2', klass: '2', number: '9',
    lastName: '鈴木', firstName: 'YFLJ',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:12:00',
    grade: '2', klass: '2', number: '10',
    lastName: '吉田', firstName: 'UDGV',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:15:00',
    grade: '2', klass: '2', number: '11',
    lastName: '斎藤', firstName: 'YQLU',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 16:15〜16:30, 15:15〜15:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:18:00',
    grade: '2', klass: '2', number: '12',
    lastName: '山本', firstName: 'NZNX',
    sibling: `2-1-7 山本RXRH`,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 16:00〜16:15, 13:45〜14:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 13:21:00',
    grade: '2', klass: '2', number: '13',
    lastName: '斎藤', firstName: 'NZPK',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 13:24:00',
    grade: '2', klass: '2', number: '14',
    lastName: '山田', firstName: 'PVEU',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 14:30〜14:45, 14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:27:00',
    grade: '2', klass: '2', number: '15',
    lastName: '佐藤', firstName: 'HHKV',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 13:30:00',
    grade: '2', klass: '2', number: '16',
    lastName: '山田', firstName: 'LKLY',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:33:00',
    grade: '2', klass: '2', number: '17',
    lastName: '加藤', firstName: 'HBRH',
    sibling: `6-1-23 加藤ZYBR`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 15:00〜15:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:36:00',
    grade: '2', klass: '2', number: '18',
    lastName: '清水', firstName: 'VSYD',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:39:00',
    grade: '2', klass: '2', number: '19',
    lastName: '松本', firstName: 'YJUP',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:00〜15:15, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:45:00',
    grade: '2', klass: '2', number: '21',
    lastName: '吉田', firstName: 'STPG',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:48:00',
    grade: '2', klass: '2', number: '22',
    lastName: '林', firstName: 'APJV',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:00〜15:15, 16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:51:00',
    grade: '2', klass: '2', number: '23',
    lastName: '鈴木', firstName: 'LSJX',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:54:00',
    grade: '2', klass: '2', number: '24',
    lastName: '中村', firstName: 'JYXW',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 13:57:00',
    grade: '2', klass: '2', number: '25',
    lastName: '渡辺', firstName: 'TQWP',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 16:00〜16:15, 13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 14:00:00',
    grade: '3', klass: '1', number: '1',
    lastName: '林', firstName: 'FVKL',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 14:03:00',
    grade: '3', klass: '1', number: '2',
    lastName: '吉田', firstName: 'NCFC',
    sibling: `3-2-8 吉田UMNM`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 14:00〜14:15, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 14:06:00',
    grade: '3', klass: '1', number: '3',
    lastName: '林', firstName: 'AYNZ',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 15:30〜15:45, 13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 14:09:00',
    grade: '3', klass: '1', number: '4',
    lastName: '鈴木', firstName: 'BTVC',
    sibling: `1-1-12 鈴木TXPF, 5-2-19 鈴木ENDE`,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 14:12:00',
    grade: '3', klass: '1', number: '5',
    lastName: '佐々木', firstName: 'JZPJ',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 14:15:00',
    grade: '3', klass: '1', number: '6',
    lastName: '渡辺', firstName: 'QNHQ',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 15:45〜16:00, 14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 14:18:00',
    grade: '3', klass: '1', number: '7',
    lastName: '木村', firstName: 'HXWR',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 15:30〜15:45, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 16:00〜16:15, 14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 14:21:00',
    grade: '3', klass: '1', number: '8',
    lastName: '高橋', firstName: 'ELLK',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 14:24:00',
    grade: '3', klass: '1', number: '9',
    lastName: '吉田', firstName: 'YMNP',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 14:27:00',
    grade: '3', klass: '1', number: '10',
    lastName: '山本', firstName: 'SMMP',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 14:45〜15:00, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 14:30:00',
    grade: '3', klass: '1', number: '11',
    lastName: '鈴木', firstName: 'JLGM',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 14:33:00',
    grade: '3', klass: '1', number: '12',
    lastName: '中村', firstName: 'RBKT',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 16:00〜16:15, 14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 14:36:00',
    grade: '3', klass: '1', number: '13',
    lastName: '佐藤', firstName: 'XCPN',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 14:00〜14:15, 14:30〜14:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 14:39:00',
    grade: '3', klass: '1', number: '14',
    lastName: '木村', firstName: 'QYJL',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 14:42:00',
    grade: '3', klass: '1', number: '15',
    lastName: '山田', firstName: 'TAJH',
    sibling: `5-2-9 山田ZMYA`,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 15:30〜15:45, 14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 14:45:00',
    grade: '3', klass: '1', number: '16',
    lastName: '中村', firstName: 'LGHP',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 14:48:00',
    grade: '3', klass: '1', number: '17',
    lastName: '加藤', firstName: 'SRYJ',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 15:30〜15:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 14:51:00',
    grade: '3', klass: '1', number: '18',
    lastName: '松本', firstName: 'NJYC',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 16:00〜16:15, 14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 14:54:00',
    grade: '3', klass: '1', number: '19',
    lastName: '松本', firstName: 'VLNL',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:00:00',
    grade: '3', klass: '1', number: '21',
    lastName: '山口', firstName: 'JXLY',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 14:00〜14:15, 14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:03:00',
    grade: '3', klass: '1', number: '22',
    lastName: '松本', firstName: 'SPNV',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:06:00',
    grade: '3', klass: '1', number: '23',
    lastName: '山本', firstName: 'BQLS',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:09:00',
    grade: '3', klass: '1', number: '24',
    lastName: '清水', firstName: 'ZFXP',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:12:00',
    grade: '3', klass: '1', number: '25',
    lastName: '山口', firstName: 'PBJR',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:15:00',
    grade: '3', klass: '2', number: '1',
    lastName: '佐々木', firstName: 'WDMB',
    sibling: `5-1-16 佐々木NVBK`,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 15:18:00',
    grade: '3', klass: '2', number: '2',
    lastName: '渡辺', firstName: 'ABVQ',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:21:00',
    grade: '3', klass: '2', number: '3',
    lastName: '高橋', firstName: 'TUXS',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 13:45〜14:00, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 15:24:00',
    grade: '3', klass: '2', number: '4',
    lastName: '吉田', firstName: 'KPFD',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 14:15〜14:30, 15:15〜15:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 15:27:00',
    grade: '3', klass: '2', number: '5',
    lastName: '林', firstName: 'MTJD',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 15:30:00',
    grade: '3', klass: '2', number: '6',
    lastName: '中村', firstName: 'BDFL',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 16:15〜16:30, 15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 15:33:00',
    grade: '3', klass: '2', number: '7',
    lastName: '山口', firstName: 'VXCC',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 15:36:00',
    grade: '3', klass: '2', number: '8',
    lastName: '吉田', firstName: 'UMNM',
    sibling: `3-1-2 吉田NCFC`,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 15:39:00',
    grade: '3', klass: '2', number: '9',
    lastName: '田中', firstName: 'SBWR',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 13:30〜13:45, 13:45〜14:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 15:42:00',
    grade: '3', klass: '2', number: '10',
    lastName: '佐藤', firstName: 'EWAE',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15, 15:30〜15:45, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:45:00',
    grade: '3', klass: '2', number: '11',
    lastName: '鈴木', firstName: 'NZBL',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 15:48:00',
    grade: '3', klass: '2', number: '12',
    lastName: '斎藤', firstName: 'YLSR',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:51:00',
    grade: '3', klass: '2', number: '13',
    lastName: '佐々木', firstName: 'HCAH',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 13:30〜13:45, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:54:00',
    grade: '3', klass: '2', number: '14',
    lastName: '佐藤', firstName: 'YYQM',
    sibling: `1-1-8 佐藤EJDY`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:45〜16:00, 16:00〜16:15, 16:15〜16:30, 16:30〜16:45, 16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 15:57:00',
    grade: '3', klass: '2', number: '15',
    lastName: '佐々木', firstName: 'AKUT',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:00:00',
    grade: '3', klass: '2', number: '16',
    lastName: '鈴木', firstName: 'EGHU',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 14:00〜14:15, 14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 16:03:00',
    grade: '3', klass: '2', number: '17',
    lastName: '吉田', firstName: 'LVRQ',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 16:06:00',
    grade: '3', klass: '2', number: '18',
    lastName: '木村', firstName: 'EZEU',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 13:45〜14:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15, 15:15〜15:30, 14:00〜14:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:09:00',
    grade: '3', klass: '2', number: '19',
    lastName: '渡辺', firstName: 'TUBZ',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:15:00',
    grade: '3', klass: '2', number: '21',
    lastName: '松本', firstName: 'JMSS',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:18:00',
    grade: '3', klass: '2', number: '22',
    lastName: '渡辺', firstName: 'JJUN',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:21:00',
    grade: '3', klass: '2', number: '23',
    lastName: '高橋', firstName: 'SDZF',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 15:00〜15:15, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 16:24:00',
    grade: '3', klass: '2', number: '24',
    lastName: '渡辺', firstName: 'XLLA',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 16:27:00',
    grade: '3', klass: '2', number: '25',
    lastName: '林', firstName: 'NRQQ',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:30:00',
    grade: '4', klass: '1', number: '1',
    lastName: '中村', firstName: 'HESN',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:33:00',
    grade: '4', klass: '1', number: '2',
    lastName: '吉田', firstName: 'WQWY',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 15:15〜15:30, 16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:36:00',
    grade: '4', klass: '1', number: '3',
    lastName: '佐藤', firstName: 'GNEL',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 16:39:00',
    grade: '4', klass: '1', number: '4',
    lastName: '山口', firstName: 'CVUH',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 16:42:00',
    grade: '4', klass: '1', number: '5',
    lastName: '山口', firstName: 'DDEE',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:45:00',
    grade: '4', klass: '1', number: '6',
    lastName: '高橋', firstName: 'DUKB',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:48:00',
    grade: '4', klass: '1', number: '7',
    lastName: '小林', firstName: 'RKBV',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 13:30〜13:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 16:51:00',
    grade: '4', klass: '1', number: '8',
    lastName: '渡辺', firstName: 'QLPB',
    sibling: `1-2-17 渡辺VKBR, 2-1-14 渡辺UKXH, 6-2-5 渡辺ZCUR`,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 16:54:00',
    grade: '4', klass: '1', number: '9',
    lastName: '佐藤', firstName: 'CUMC',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 14:30〜14:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 16:57:00',
    grade: '4', klass: '1', number: '10',
    lastName: '山口', firstName: 'BRRB',
    sibling: `4-2-4 山口QNLA`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:00:00',
    grade: '4', klass: '1', number: '11',
    lastName: '高橋', firstName: 'ZLDB',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:03:00',
    grade: '4', klass: '1', number: '12',
    lastName: '清水', firstName: 'PQDJ',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 17:06:00',
    grade: '4', klass: '1', number: '13',
    lastName: '吉田', firstName: 'UFRF',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 15:30〜15:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:09:00',
    grade: '4', klass: '1', number: '14',
    lastName: '林', firstName: 'KFRB',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 15:30〜15:45, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:12:00',
    grade: '4', klass: '1', number: '15',
    lastName: '田中', firstName: 'GABU',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:15:00',
    grade: '4', klass: '1', number: '16',
    lastName: '渡辺', firstName: 'NKRW',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:18:00',
    grade: '4', klass: '1', number: '17',
    lastName: '渡辺', firstName: 'QHTT',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:21:00',
    grade: '4', klass: '1', number: '18',
    lastName: '伊藤', firstName: 'FPPZ',
    sibling: `2-1-5 伊藤XMGP`,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 15:30〜15:45, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:24:00',
    grade: '4', klass: '1', number: '19',
    lastName: '伊藤', firstName: 'JGCP',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 17:30:00',
    grade: '4', klass: '1', number: '21',
    lastName: '清水', firstName: 'ZYBM',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 14:30〜14:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:33:00',
    grade: '4', klass: '1', number: '22',
    lastName: '山田', firstName: 'QMUE',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:36:00',
    grade: '4', klass: '1', number: '23',
    lastName: '田中', firstName: 'UKTH',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:39:00',
    grade: '4', klass: '1', number: '24',
    lastName: '清水', firstName: 'KXMT',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:42:00',
    grade: '4', klass: '1', number: '25',
    lastName: '佐々木', firstName: 'STHG',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:45:00',
    grade: '4', klass: '2', number: '1',
    lastName: '吉田', firstName: 'KNZE',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 17:48:00',
    grade: '4', klass: '2', number: '2',
    lastName: '中村', firstName: 'ZKBH',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 16:15〜16:30, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:51:00',
    grade: '4', klass: '2', number: '3',
    lastName: '高橋', firstName: 'AVZD',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 13:30〜13:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:54:00',
    grade: '4', klass: '2', number: '4',
    lastName: '山口', firstName: 'QNLA',
    sibling: `4-1-10 山口BRRB`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 13:30〜13:45, 15:00〜15:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 17:57:00',
    grade: '4', klass: '2', number: '5',
    lastName: '山本', firstName: 'XGLD',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 13:45〜14:00, 14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 16:00〜16:15, 15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 18:00:00',
    grade: '4', klass: '2', number: '6',
    lastName: '松本', firstName: 'ZUJP',
    sibling: `6-2-11 松本VMJQ`,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 18:03:00',
    grade: '4', klass: '2', number: '7',
    lastName: '伊藤', firstName: 'CRGV',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 14:00〜14:15, 16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 18:06:00',
    grade: '4', klass: '2', number: '8',
    lastName: '山田', firstName: 'YPPE',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 18:09:00',
    grade: '4', klass: '2', number: '9',
    lastName: '林', firstName: 'AYED',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 18:12:00',
    grade: '4', klass: '2', number: '10',
    lastName: '吉田', firstName: 'HDDY',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 18:15:00',
    grade: '4', klass: '2', number: '11',
    lastName: '伊藤', firstName: 'QYZF',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 18:18:00',
    grade: '4', klass: '2', number: '12',
    lastName: '吉田', firstName: 'LGFB',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 15:00〜15:15, 15:15〜15:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 18:21:00',
    grade: '4', klass: '2', number: '13',
    lastName: '中村', firstName: 'BAZC',
    sibling: `2-1-9 中村CJTG, 6-1-2 中村FNKJ`,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 18:24:00',
    grade: '4', klass: '2', number: '14',
    lastName: '鈴木', firstName: 'JXDB',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 18:27:00',
    grade: '4', klass: '2', number: '15',
    lastName: '高橋', firstName: 'HZKP',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 18:30:00',
    grade: '4', klass: '2', number: '16',
    lastName: '山田', firstName: 'ACVR',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 18:33:00',
    grade: '4', klass: '2', number: '17',
    lastName: '加藤', firstName: 'UMXG',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 18:36:00',
    grade: '4', klass: '2', number: '18',
    lastName: '木村', firstName: 'BUSC',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 16:00〜16:15, 15:15〜15:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 18:39:00',
    grade: '4', klass: '2', number: '19',
    lastName: '加藤', firstName: 'BXTN',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 18:45:00',
    grade: '4', klass: '2', number: '21',
    lastName: '山口', firstName: 'DPPZ',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 18:48:00',
    grade: '4', klass: '2', number: '22',
    lastName: '小林', firstName: 'KQSK',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 13:30〜13:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 18:51:00',
    grade: '4', klass: '2', number: '23',
    lastName: '渡辺', firstName: 'HTUH',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 14:45〜15:00, 13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 18:54:00',
    grade: '4', klass: '2', number: '24',
    lastName: '加藤', firstName: 'TKUN',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 18:57:00',
    grade: '4', klass: '2', number: '25',
    lastName: '小林', firstName: 'JMKY',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 15:30〜15:45, 14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 13:45〜14:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:00:00',
    grade: '5', klass: '1', number: '1',
    lastName: '佐藤', firstName: 'DPZW',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:03:00',
    grade: '5', klass: '1', number: '2',
    lastName: '伊藤', firstName: 'QAGV',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 13:45〜14:00, 13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 19:06:00',
    grade: '5', klass: '1', number: '3',
    lastName: '渡辺', firstName: 'QHCB',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 19:09:00',
    grade: '5', klass: '1', number: '4',
    lastName: '渡辺', firstName: 'TRZG',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 19:12:00',
    grade: '5', klass: '1', number: '5',
    lastName: '清水', firstName: 'HERP',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:15:00',
    grade: '5', klass: '1', number: '6',
    lastName: '林', firstName: 'LXJQ',
    sibling: `5-2-15 林BWDE`,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 19:18:00',
    grade: '5', klass: '1', number: '7',
    lastName: '木村', firstName: 'XZDW',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:21:00',
    grade: '5', klass: '1', number: '8',
    lastName: '木村', firstName: 'UMUC',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:24:00',
    grade: '5', klass: '1', number: '9',
    lastName: '田中', firstName: 'RFSJ',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 19:27:00',
    grade: '5', klass: '1', number: '10',
    lastName: '渡辺', firstName: 'NLSD',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 14:15〜14:30, 16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:30:00',
    grade: '5', klass: '1', number: '11',
    lastName: '山田', firstName: 'TVKR',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:33:00',
    grade: '5', klass: '1', number: '12',
    lastName: '佐々木', firstName: 'CGSE',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 15:30〜15:45, 15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:36:00',
    grade: '5', klass: '1', number: '13',
    lastName: '高橋', firstName: 'MQUV',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    }
  },
  {
    timestamp: '2026/05/20 19:39:00',
    grade: '5', klass: '1', number: '14',
    lastName: '田中', firstName: 'SXWS',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 19:42:00',
    grade: '5', klass: '1', number: '15',
    lastName: '佐藤', firstName: 'CEAG',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:45:00',
    grade: '5', klass: '1', number: '16',
    lastName: '佐々木', firstName: 'NVBK',
    sibling: `3-2-1 佐々木WDMB`,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 19:48:00',
    grade: '5', klass: '1', number: '17',
    lastName: '林', firstName: 'VRVC',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 16:00〜16:15, 15:15〜15:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:51:00',
    grade: '5', klass: '1', number: '18',
    lastName: '山田', firstName: 'QWXT',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 19:54:00',
    grade: '5', klass: '1', number: '19',
    lastName: '清水', firstName: 'UPPZ',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 15:30〜15:45, 15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:00:00',
    grade: '5', klass: '1', number: '21',
    lastName: '田中', firstName: 'CKPA',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 16:15〜16:30, 13:30〜13:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 15:30〜15:45, 15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 20:03:00',
    grade: '5', klass: '1', number: '22',
    lastName: '高橋', firstName: 'CRAJ',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:06:00',
    grade: '5', klass: '1', number: '23',
    lastName: '山口', firstName: 'CQEY',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 20:09:00',
    grade: '5', klass: '1', number: '24',
    lastName: '木村', firstName: 'YDMN',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 20:12:00',
    grade: '5', klass: '1', number: '25',
    lastName: '山口', firstName: 'ZXUG',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 15:30〜15:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:15:00',
    grade: '5', klass: '2', number: '1',
    lastName: '加藤', firstName: 'SYDT',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 16:15〜16:30, 15:00〜15:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 20:18:00',
    grade: '5', klass: '2', number: '2',
    lastName: '清水', firstName: 'CKBB',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:21:00',
    grade: '5', klass: '2', number: '3',
    lastName: '高橋', firstName: 'QSPF',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 16:15〜16:30, 14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:24:00',
    grade: '5', klass: '2', number: '4',
    lastName: '山本', firstName: 'QUWV',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:27:00',
    grade: '5', klass: '2', number: '5',
    lastName: '清水', firstName: 'CAGG',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:30:00',
    grade: '5', klass: '2', number: '6',
    lastName: '渡辺', firstName: 'WHUP',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 20:33:00',
    grade: '5', klass: '2', number: '7',
    lastName: '中村', firstName: 'XRHH',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:36:00',
    grade: '5', klass: '2', number: '8',
    lastName: '吉田', firstName: 'KVCG',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 13:30〜13:45, 14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:39:00',
    grade: '5', klass: '2', number: '9',
    lastName: '山田', firstName: 'ZMYA',
    sibling: `3-1-15 山田TAJH`,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:42:00',
    grade: '5', klass: '2', number: '10',
    lastName: '山口', firstName: 'RYTD',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:45:00',
    grade: '5', klass: '2', number: '11',
    lastName: '山口', firstName: 'KRLA',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:48:00',
    grade: '5', klass: '2', number: '12',
    lastName: '加藤', firstName: 'QGYK',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15, 14:00〜14:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:51:00',
    grade: '5', klass: '2', number: '13',
    lastName: '山田', firstName: 'YAWD',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 15:00〜15:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:54:00',
    grade: '5', klass: '2', number: '14',
    lastName: '伊藤', firstName: 'FWEE',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15, 13:45〜14:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 20:57:00',
    grade: '5', klass: '2', number: '15',
    lastName: '林', firstName: 'BWDE',
    sibling: `5-1-6 林LXJQ`,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 21:00:00',
    grade: '5', klass: '2', number: '16',
    lastName: '加藤', firstName: 'SDPV',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 21:03:00',
    grade: '5', klass: '2', number: '17',
    lastName: '渡辺', firstName: 'SHML',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:06:00',
    grade: '5', klass: '2', number: '18',
    lastName: '鈴木', firstName: 'TXWR',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 21:09:00',
    grade: '5', klass: '2', number: '19',
    lastName: '鈴木', firstName: 'ENDE',
    sibling: `1-1-12 鈴木TXPF, 3-1-4 鈴木BTVC`,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:15:00',
    grade: '5', klass: '2', number: '21',
    lastName: '山本', firstName: 'NUKY',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 21:18:00',
    grade: '5', klass: '2', number: '22',
    lastName: '鈴木', firstName: 'NKXN',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:21:00',
    grade: '5', klass: '2', number: '23',
    lastName: '小林', firstName: 'FEJT',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 14:15〜14:30, 15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:24:00',
    grade: '5', klass: '2', number: '24',
    lastName: '田中', firstName: 'FDQD',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:27:00',
    grade: '5', klass: '2', number: '25',
    lastName: '加藤', firstName: 'YFQM',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 21:30:00',
    grade: '6', klass: '1', number: '1',
    lastName: '清水', firstName: 'FKCE',
    sibling: `6-2-20 清水RXNA`,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:33:00',
    grade: '6', klass: '1', number: '2',
    lastName: '中村', firstName: 'FNKJ',
    sibling: `2-1-9 中村CJTG, 4-2-13 中村BAZC`,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 14:45〜15:00, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 21:36:00',
    grade: '6', klass: '1', number: '3',
    lastName: '鈴木', firstName: 'GXKE',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15, 14:15〜14:30, 14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:39:00',
    grade: '6', klass: '1', number: '4',
    lastName: '木村', firstName: 'GWLJ',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15, 14:45〜15:00, 15:30〜15:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    }
  },
  {
    timestamp: '2026/05/20 21:42:00',
    grade: '6', klass: '1', number: '5',
    lastName: '高橋', firstName: 'TLSD',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:45:00',
    grade: '6', klass: '1', number: '6',
    lastName: '渡辺', firstName: 'MQCG',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:48:00',
    grade: '6', klass: '1', number: '7',
    lastName: '小林', firstName: 'LERV',
    sibling: `2-1-20 小林UPCB`,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:51:00',
    grade: '6', klass: '1', number: '8',
    lastName: '田中', firstName: 'ZCGK',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 21:54:00',
    grade: '6', klass: '1', number: '9',
    lastName: '中村', firstName: 'QEYP',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 13:45〜14:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 21:57:00',
    grade: '6', klass: '1', number: '10',
    lastName: '佐々木', firstName: 'PUUZ',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 22:00:00',
    grade: '6', klass: '1', number: '11',
    lastName: '清水', firstName: 'NSGG',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:03:00',
    grade: '6', klass: '1', number: '12',
    lastName: '山本', firstName: 'FFGF',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 13:30〜13:45, 15:30〜15:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 15:45〜16:00, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 22:06:00',
    grade: '6', klass: '1', number: '13',
    lastName: '清水', firstName: 'GFPB',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 13:30〜13:45, 16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 22:09:00',
    grade: '6', klass: '1', number: '14',
    lastName: '吉田', firstName: 'JWEG',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 14:45〜15:00, 16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    }
  },
  {
    timestamp: '2026/05/20 22:12:00',
    grade: '6', klass: '1', number: '15',
    lastName: '木村', firstName: 'DPFC',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 14:00〜14:15, 16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:15:00',
    grade: '6', klass: '1', number: '16',
    lastName: '渡辺', firstName: 'ZWNT',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:18:00',
    grade: '6', klass: '1', number: '17',
    lastName: '高橋', firstName: 'LJJP',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:21:00',
    grade: '6', klass: '1', number: '18',
    lastName: '山田', firstName: 'HNUL',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 22:24:00',
    grade: '6', klass: '1', number: '19',
    lastName: '伊藤', firstName: 'JHRT',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 14:00〜14:15, 16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:27:00',
    grade: '6', klass: '1', number: '20',
    lastName: '鈴木', firstName: 'FKCY',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:30:00',
    grade: '6', klass: '1', number: '21',
    lastName: '佐々木', firstName: 'HFGR',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:15〜15:30, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 22:33:00',
    grade: '6', klass: '1', number: '22',
    lastName: '渡辺', firstName: 'ZSEQ',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15, 14:30〜14:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:36:00',
    grade: '6', klass: '1', number: '23',
    lastName: '加藤', firstName: 'ZYBR',
    sibling: `2-2-17 加藤HBRH`,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45, 13:30〜13:45, 15:00〜15:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:39:00',
    grade: '6', klass: '1', number: '24',
    lastName: '斎藤', firstName: 'JKPK',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 22:42:00',
    grade: '6', klass: '1', number: '25',
    lastName: '斎藤', firstName: 'VKWE',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 14:45〜15:00, 13:30〜13:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:45:00',
    grade: '6', klass: '2', number: '1',
    lastName: '高橋', firstName: 'GDLA',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 15:15〜15:30, 13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:48:00',
    grade: '6', klass: '2', number: '2',
    lastName: '小林', firstName: 'UBME',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:00〜15:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 13:30〜13:45, 16:15〜16:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:51:00',
    grade: '6', klass: '2', number: '3',
    lastName: '山本', firstName: 'MSHH',
    sibling: ``,
    topic: '学習について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:54:00',
    grade: '6', klass: '2', number: '4',
    lastName: '中村', firstName: 'RHEG',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 15:45〜16:00, 14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 22:57:00',
    grade: '6', klass: '2', number: '5',
    lastName: '渡辺', firstName: 'ZCUR',
    sibling: `1-2-17 渡辺VKBR, 2-1-14 渡辺UKXH, 4-1-8 渡辺QLPB`,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:00:00',
    grade: '6', klass: '2', number: '6',
    lastName: '吉田', firstName: 'ZUUV',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:30〜14:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 15:15〜15:30, 15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:03:00',
    grade: '6', klass: '2', number: '7',
    lastName: '林', firstName: 'EEJT',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:06:00',
    grade: '6', klass: '2', number: '8',
    lastName: '斎藤', firstName: 'JARK',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30, 15:30〜15:45, 15:15〜15:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:09:00',
    grade: '6', klass: '2', number: '9',
    lastName: '加藤', firstName: 'HRCN',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:12:00',
    grade: '6', klass: '2', number: '10',
    lastName: '高橋', firstName: 'ARKM',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:45〜14:00, 15:15〜15:30, 13:30〜13:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    }
  },
  {
    timestamp: '2026/05/20 23:15:00',
    grade: '6', klass: '2', number: '11',
    lastName: '松本', firstName: 'VMJQ',
    sibling: `4-2-6 松本ZUJP`,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:18:00',
    grade: '6', klass: '2', number: '12',
    lastName: '中村', firstName: 'NENF',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:45〜17:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15, 15:15〜15:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    }
  },
  {
    timestamp: '2026/05/20 23:21:00',
    grade: '6', klass: '2', number: '13',
    lastName: '伊藤', firstName: 'PNRN',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `16:00〜16:15`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30, 14:45〜15:00, 15:45〜16:00`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': `16:30〜16:45`,
    }
  },
  {
    timestamp: '2026/05/20 23:24:00',
    grade: '6', klass: '2', number: '14',
    lastName: '小林', firstName: 'JLZA',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:27:00',
    grade: '6', klass: '2', number: '15',
    lastName: '中村', firstName: 'FHUY',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:00〜14:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:30:00',
    grade: '6', klass: '2', number: '16',
    lastName: '小林', firstName: 'VCKY',
    sibling: ``,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 15:45〜16:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:33:00',
    grade: '6', klass: '2', number: '17',
    lastName: '山田', firstName: 'XLYC',
    sibling: ``,
    topic: '友人関係について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:36:00',
    grade: '6', klass: '2', number: '18',
    lastName: '佐藤', firstName: 'SZZU',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:39:00',
    grade: '6', klass: '2', number: '19',
    lastName: '佐藤', firstName: 'PGKL',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:42:00',
    grade: '6', klass: '2', number: '20',
    lastName: '清水', firstName: 'RXNA',
    sibling: `6-1-1 清水FKCE`,
    topic: '生活習慣について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:45:00',
    grade: '6', klass: '2', number: '21',
    lastName: '渡辺', firstName: 'VVQL',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:48:00',
    grade: '6', klass: '2', number: '22',
    lastName: '渡辺', firstName: 'WVAS',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:15〜14:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:30〜15:45, 15:15〜15:30`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:51:00',
    grade: '6', klass: '2', number: '23',
    lastName: '田中', firstName: 'KXNG',
    sibling: ``,
    topic: '',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 15:15〜15:30`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:54:00',
    grade: '6', klass: '2', number: '24',
    lastName: '小林', firstName: 'RXJC',
    sibling: ``,
    topic: 'とくになし',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00`,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `15:45〜16:00, 15:30〜15:45, 13:45〜14:00`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 23:57:00',
    grade: '6', klass: '2', number: '25',
    lastName: '松本', firstName: 'PTAY',
    sibling: ``,
    topic: '進路について',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': `16:15〜16:30`,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': `14:45〜15:00, 16:00〜16:15`,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': `13:30〜13:45, 16:00〜16:15`,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  {
    timestamp: '2026/05/20 11:00:00',
    grade: '1', klass: '1', number: '1',
    lastName: '高橋', firstName: 'AGFT',
    sibling: ``,
    topic: '再送信テスト（重複確認用）',
    badTimes: {
    '6月15日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月16日（火） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月18日（木） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月19日（金） の都合の悪い時間（該当するものをすべて選択）': ``,
    '6月22日（月） の都合の悪い時間（該当するものをすべて選択）': ``,
    }
  },
  ];

  testRows.forEach((data, i) => {
    const ts = new Date(data.timestamp);
    const row = new Array(headers.length).fill('');
    headers.forEach((h, idx) => {
      const hs = String(h);
      if (idx === 0)                    row[idx] = ts;
      else if (hs.includes('学年'))      row[idx] = data.grade;
      else if (hs === '組')             row[idx] = data.klass;
      else if (hs.includes('番号'))      row[idx] = data.number;
      else if (hs.includes('姓'))        row[idx] = data.lastName;
      else if (hs.includes('名') && !hs.includes('学年') && !hs.includes('番号')) row[idx] = data.firstName;
      else if (hs.includes('兄弟姉妹'))  row[idx] = data.sibling;
      else if (hs.includes('都合の悪い')) {
        const matched = Object.keys(data.badTimes).find(k => hs.includes(k.split(' ')[0]));
        if (matched) row[idx] = data.badTimes[matched];
      }
      else if (hs.includes('話題'))      row[idx] = data.topic;
    });
    sheet.appendRow(row);
  });

  Logger.log('テストデータ挿入完了: ' + testRows.length + ' 件');
  Logger.log('うち未回答（未挿入）: 10名（各学年20番）');
  Logger.log('うち重複回答テスト: 1件（1年1組1番）');
}

// ============================================
// 名簿シートから学年・クラス・最大番号を取得する
// 画面1のフォーム生成と画面ロード時に使用
// ============================================
function getRosterInfo() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('名簿');

  if (!sheet) {
    return JSON.stringify({
      error: '名簿シートが見つかりません。スプレッドシートに「名簿」シートを作成してCSVを貼り付けてください。'
    });
  }

  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return JSON.stringify({
      error: '名簿シートにデータがありません。CSVを貼り付けてください。'
    });
  }

  const headers = data[0].map(h => String(h).trim());

  const gradeIdx  = headers.findIndex(h => h.includes('学年'));
  const klassIdx  = headers.findIndex(h => h === '組' || h.includes('クラス'));
  const numberIdx = headers.findIndex(h => h.includes('番号') || h === '番');

  if (gradeIdx < 0 || klassIdx < 0 || numberIdx < 0) {
    return JSON.stringify({
      error: '名簿シートの列が正しくありません。「学年」「組」「番号」「姓」「名」の列が必要です。'
    });
  }

  // classSizes = { "1-1": 25, "1-2": 24, ... }
  const classSizes     = {};
  const classesPerGrade = {};
  let maxNumber = 1;

  data.slice(1).forEach(row => {
    const grade  = String(row[gradeIdx]  || '').trim();
    const klass  = String(row[klassIdx]  || '').trim();
    const number = parseInt(row[numberIdx]);
    if (!grade || !klass || isNaN(number)) return;

    const key = grade + '-' + klass;
    if (!classSizes[key] || number > classSizes[key]) {
      classSizes[key] = number;
    }

    const klassNum = parseInt(klass);
    if (!classesPerGrade[grade] || klassNum > classesPerGrade[grade]) {
      classesPerGrade[grade] = klassNum;
    }

    if (number > maxNumber) maxNumber = number;
  });

  const numGrades  = Object.keys(classesPerGrade).length;
  const numClasses = Math.max(...Object.values(classesPerGrade));

  return JSON.stringify({
    numGrades,
    numClasses,
    classesPerGrade,
    classSizes,
    maxNumber,
    totalClasses: Object.keys(classSizes).length
  });
}

// ============================================
// 画面3：スケジューリング実行
// index.htmlのrunScheduleBtnから呼ばれる
//
// 【設計の核心】
// 面談コマはクラスごとに独立している
// （1年1組の14:30と1年2組の14:30は別のコマ）
// そのためslotMapはクラスごとに作成する
//
// 【処理フロー】
// ① 全生徒データを準備（NGセット・キーを付与）
// ② 兄弟姉妹グループを抽出（クラスをまたぐため全体で処理）
// ③ 兄弟姉妹調整を先に実行（同日割り当て予約を記録）
// ④ クラスごとにslotMapを作成してスケジューリング
//    ④-1 手動指定を配置
//    ④-2 兄弟姉妹の同日予約を配置
//    ④-3 残りを制約優先で自動割り当て
// ⑤ 全クラスの結果をシートに保存
// ⑥ 集計して返す
// ============================================
function runScheduling(jsonStr) {
  const props = PropertiesService.getScriptProperties();
  const s1str = props.getProperty('scheduleSettings');
  if (!s1str) return JSON.stringify({ error: '画面1の設定が見つかりません' });

  const s1       = JSON.parse(s1str);
  const payload  = JSON.parse(jsonStr);
  const students = payload.students || [];

  // ============================================
  // ① 全生徒データを準備する
  // ============================================
  const allSlots = buildAllSlots(s1);

  const studentMap = {};
  students.forEach(s => {
    const key = `${s.grade}-${s.klass}-${s.number}`;
    const ngSet = new Set();
    (s.badTimes || []).forEach(bt => {
      bt.times.forEach(t => {
        const startTime = t.split('〜')[0].trim();
        ngSet.add(`${bt.date}_${startTime}`);
      });
    });
    s._ngSet        = ngSet;
    s._key          = key;
    s._assignedSlot = null;
    s._failed       = false;
    studentMap[key] = s;
  });

  const siblingResults    = [];
  const unassignedStudents = [];

  // ============================================
  // ② 兄弟姉妹グループを抽出する（全クラス横断）
  // ============================================
  const siblingGroups = extractSiblingGroups(students, studentMap);

  // ============================================
  // ③ 全クラスのslotMapを先に初期化する
  //    クラスをまたいだ兄弟姉妹調整のために
  //    先に全クラスのslotMapを作っておく
  // ============================================
  const classKeys = [...new Set(
    students.map(s => `${s.grade}-${s.klass}`)
  )].sort();

  const allSlotMaps = {};
  classKeys.forEach(ck => {
    allSlotMaps[ck] = {};
    allSlots.forEach(sl => { allSlotMaps[ck][sl.key] = null; });
  });

  // ============================================
  // ④ 全クラスの手動指定を先に配置する
  //    兄弟姉妹調整より前に手動指定コマを確保する
  // ============================================
  classKeys.forEach(ck => {
    const [grade, klass] = ck.split('-');
    const slotMap = allSlotMaps[ck];
    students
      .filter(s => s.grade === grade && s.klass === klass)
      .forEach(s => {
        if (s.treatment !== 'manual') return;
        if (s._assignedSlot || s._failed) return;
        if (!s.manualSlot) return;
        if (slotMap[s.manualSlot] === null) {
          s._assignedSlot    = s.manualSlot;
          slotMap[s.manualSlot] = s._key;
        } else {
          Logger.log(`手動指定コマが埋まっています: ${s._key} → ${s.manualSlot}`);
        }
      });
  });

  // ============================================
  // ⑤ 兄弟姉妹グループをクラスをまたいで配置する
  //
  //    【重要な仕様】
  //    保護者は1人なので同じ時間には入れられない。
  //    グループ内で「使用済み時刻セット」を共有し
  //    1コマバッファ（間に1コマ空ける）をあけて配置する。
  //
  //    例：兄弟① 15:30 → バッファ 15:45 → 兄弟② 16:00
  // ============================================
  siblingGroups.forEach(group => {
    const activeMembers = group.filter(s =>
      s.treatment !== 'none' && !s._assignedSlot && !s._failed
    );
    if (activeMembers.length <= 1) return;

    const memberNames = activeMembers.map(s =>
      `${s.grade}年${s.klass}組${s.number}番 ${s.lastName}${s.firstName}`
    );

    // 全員が「1コマバッファ込みで」配置できる日を探す
    // 必要コマ数 = メンバー数 + バッファ数（メンバー数 - 1）
    let placedDate = null;
    for (const dateObj of s1.dates) {
      const date = dateObj.date;
      const dateSlotsCount = allSlots.filter(sl => sl.date === date).length;
      const neededSlots    = activeMembers.length * 2 - 1; // バッファ込み

      if (dateSlotsCount < neededSlots) continue;

      // 全員がその日に1コマ以上空きがあるか確認
      const allHaveSlot = activeMembers.every(s =>
        allSlots.some(sl => sl.date === date && !s._ngSet.has(sl.key))
      );
      if (allHaveSlot) {
        placedDate = date;
        break;
      }
    }

    if (!placedDate) {
      siblingResults.push({ success: false, reason: '共通コマなし', members: memberNames });
      activeMembers.forEach(s => {
        s._failed = true;
        unassignedStudents.push({
          key:    s._key,
          name:   `${s.lastName} ${s.firstName}`,
          reason: '兄弟姉妹調整失敗',
        });
      });
      return;
    }

    // グループ内で使用済み時刻を共有するセット
    // 「使用中の時刻」と「バッファの時刻」を両方登録する
    const usedTimes = new Set();

    // 手動指定済みメンバーの時刻をusedTimesに先登録
    activeMembers.forEach(s => {
      if (s._assignedSlot) {
        const assignedDate = s._assignedSlot.split('_')[0];
        const assignedTime = s._assignedSlot.split('_')[1];
        usedTimes.add(`${assignedDate}_${assignedTime}`);
        const nextTime = getNextSlotTime(assignedTime, s1.slotDuration || 15);
        if (nextTime) usedTimes.add(`${assignedDate}_${nextTime}`);
      }
    });

    // 未割り当てメンバーを順番に配置
    let allPlaced = true;
    activeMembers.forEach(s => {
      if (s._assignedSlot) return; // 手動指定済みはスキップ

      const ck      = `${s.grade}-${s.klass}`;
      const slotMap = allSlotMaps[ck];

      const slot = allSlots.find(sl =>
        sl.date === placedDate      &&
        slotMap[sl.key] === null    &&
        !s._ngSet.has(sl.key)       &&
        !usedTimes.has(`${placedDate}_${sl.slot}`)
      );
      if (slot) {
        s._assignedSlot    = slot.key;
        slotMap[slot.key]  = s._key;

        // この時刻を使用済みに登録
        usedTimes.add(`${placedDate}_${slot.slot}`);
        // 次の時刻（バッファ）も使用済みに登録
        const nextTime = getNextSlotTime(slot.slot, s1.slotDuration || 15);
        if (nextTime) usedTimes.add(`${placedDate}_${nextTime}`);
      } else {
        allPlaced = false;
        Logger.log(`兄弟姉妹配置失敗: ${s._key} (${placedDate})`);
      }
    });

    if (allPlaced) {
      siblingResults.push({ success: true, members: memberNames });
    } else {
      siblingResults.push({ success: false, reason: '配置コマ不足', members: memberNames });
    }
  });

  // ============================================
  // ⑥ クラスごとに残りを自動割り当てする
  // ============================================
  classKeys.forEach(classKey => {
    const [grade, klass] = classKey.split('-');
    const slotMap        = allSlotMaps[classKey];
    const classStudents  = students.filter(s =>
      s.grade === grade && s.klass === klass
    );

    const autoTargets = classStudents.filter(s =>
      s.treatment !== 'none' &&
      !s._assignedSlot       &&
      !s._failed
    );

    autoTargets.forEach(s => {
      s._validSlotCount = allSlots.filter(sl =>
        slotMap[sl.key] === null && !s._ngSet.has(sl.key)
      ).length;
    });

    autoTargets.sort((a, b) => {
      const aIsNG = a._validSlotCount === 0;
      const bIsNG = b._validSlotCount === 0;
      if (aIsNG && !bIsNG) return 1;
      if (!aIsNG && bIsNG) return -1;
      return a._validSlotCount - b._validSlotCount;
    });

    autoTargets.forEach(s => {
      const slot = allSlots.find(sl => {
        if (slotMap[sl.key] !== null) return false;
        if (s._ngSet.has(sl.key)) return false;
        if (isRestSlot(sl, allSlots, slotMap)) return false;
        return true;
      });

      if (slot) {
        s._assignedSlot   = slot.key;
        slotMap[slot.key] = s._key;
        return;
      }

      const slotFallback = allSlots.find(sl =>
        slotMap[sl.key] === null && !s._ngSet.has(sl.key)
      );
      if (slotFallback) {
        s._assignedSlot          = slotFallback.key;
        slotMap[slotFallback.key] = s._key;
      } else {
        unassignedStudents.push({
          key:    s._key,
          name:   `${s.lastName} ${s.firstName}`,
          reason: s._ngSet.size >= allSlots.length ? '全コマNG' : '空きコマなし',
        });
      }
    });
  });

  // ============================================
  // ⑦ 結果をスプレッドシートに保存する
  // ============================================
  saveScheduleResult(students, s1);

  // ============================================
  // ⑧ 集計して返す
  // ============================================
  const noneCount       = students.filter(s => s.treatment === 'none').length;
  const assignedCount   = students.filter(s => s._assignedSlot).length;
  const unassignedCount = unassignedStudents.length;

  const studentResults = students.map(s => ({
    key:          s._key,
    assignedSlot: s._assignedSlot || null,
    failed:       s._failed || false,
  }));

  return JSON.stringify({
    assigned:           assignedCount,
    unassigned:         unassignedCount,
    none:               noneCount,
    siblingResults:     siblingResults,
    unassignedStudents: unassignedStudents,
    studentResults:     studentResults,
  });
}

// ============================================
// ヘルパー：このコマが「調整時間（空けるべきコマ）」かどうかを判定する
//
// バランス分散モードではallSlotsの並びが日付横断順になっているため
// 「同じ日のコマだけ」を取り出して連続判定する
// ============================================
function isRestSlot(sl, allSlots, slotMap) {
  // 同じ日のコマだけを時刻順で取得
  const sameDaySlots = allSlots
    .filter(s => s.date === sl.date)
    .sort((a, b) => a.slot.localeCompare(b.slot));

  const idx = sameDaySlots.findIndex(s => s.key === sl.key);
  if (idx < 3) return false;

  // 直前3コマがすべて埋まっているかチェック
  const prev3 = sameDaySlots.slice(idx - 3, idx);
  return prev3.every(s => slotMap[s.key] !== null);
}

// ============================================
// ヘルパー：1クラス分のコマ一覧を生成する
//
// 【バランス分散モード】
// 「早い日から埋める」ではなく「各日付の同じ時刻を横断して埋める」順に並べる
// 例：4/20 14:30 → 4/21 14:30 → 4/22 14:30 → ... → 4/20 14:45 → 4/21 14:45 → ...
// これにより各日程にほぼ均等に面談が分散される
//
// ※ 次バージョンで「早い日から埋める」との切り替え機能を追加予定
// ============================================
function buildAllSlots(s1) {
  const duration = s1.slotDuration || 15;

  // まず日付ごとに時刻一覧を生成する
  const byDate = [];
  s1.dates.forEach(d => {
    const times = [];
    let m = timeToMinGs(d.start);
    const endMin = timeToMinGs(d.end);
    while (m < endMin) {
      times.push(minToTime(m));
      m += duration;
    }
    byDate.push({ date: d.date, times });
  });

  // 時刻を横断して並べる（バランス分散）
  // 全日付の最大コマ数を取得
  const maxSlots = Math.max(...byDate.map(d => d.times.length));
  const slots = [];

  for (let i = 0; i < maxSlots; i++) {
    byDate.forEach(d => {
      if (i < d.times.length) {
        const slotStart = d.times[i];
        const key       = `${d.date}_${slotStart}`;
        slots.push({ date: d.date, slot: slotStart, key });
      }
    });
  }

  return slots;
}

// ============================================
// ヘルパー：兄弟姉妹グループを抽出する
// ============================================
function extractSiblingGroups(students, studentMap) {
  const groups        = [];
  const processedKeys = new Set();

  students.forEach(s => {
    if (!s.sibling) return;
    if (processedKeys.has(s._key)) return;

    const siblingKeys = s.sibling.split(',').map(part => {
      const match = part.trim().match(/^(\d+)-(\d+)-(\d+)/);
      return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
    }).filter(Boolean);

    if (siblingKeys.length === 0) return;

    const groupMembers = [s];
    siblingKeys.forEach(sk => {
      const sibling = studentMap[sk];
      if (sibling && !processedKeys.has(sk)) {
        groupMembers.push(sibling);
      }
    });

    if (groupMembers.length >= 2) {
      groups.push(groupMembers);
      groupMembers.forEach(m => processedKeys.add(m._key));
    }
  });

  return groups;
}

// ============================================
// ヘルパー：スケジュール結果をシートに保存する
// ============================================
function saveScheduleResult(students, s1) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('スケジュール結果');

  if (sheet) {
    sheet.clearContents();
  } else {
    sheet = ss.insertSheet('スケジュール結果');
  }

  const headers = ['学年','組','番号','姓','名','割り当て日','割り当て時刻','対応'];
  const rows    = [headers];

  students.forEach(s => {
    let assignedDate = '';
    let assignedTime = '';
    let status       = '';

    if (s._assignedSlot) {
      const parts  = s._assignedSlot.split('_');
      assignedDate = parts[0] || '';
      assignedTime = parts[1] || '';
      status       = '割り当て済み';
    } else if (s.treatment === 'none') {
      status = '面談なし';
    } else if (s._failed) {
      status = '未割り当て（兄弟姉妹調整失敗）';
    } else {
      status = '未割り当て';
    }

    rows.push([
      s.grade, s.klass, s.number,
      s.lastName, s.firstName,
      assignedDate, assignedTime,
      status,
    ]);
  });

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
}

// ============================================
// 画面4：クラスごとの時間割シートを出力する
//
// 呼び出し元：index.htmlの outputClass()
// 引数：jsonStr = { classKey: '1-1', students: [...] }
//
// 出力形式：時間割グリッド（日付×時間）
//   A列：時刻
//   B列以降：日付ごとの面談者（番号・姓のみ）
//   空きコマ：空白
//   シート名：「出力_1年1組」など
// ============================================
function outputClassSheet(jsonStr) {
  const payload  = JSON.parse(jsonStr);
  const classKey = payload.classKey;   // '1-1'
  const students = payload.students;   // 生徒配列

  const props = PropertiesService.getScriptProperties();
  const s1    = JSON.parse(props.getProperty('scheduleSettings'));

  const [grade, klass] = classKey.split('-');
  const sheetName      = `出力_${grade}年${klass}組`;

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(sheetName);
  if (sheet) {
    sheet.clearContents();
    sheet.clearFormats();
  } else {
    sheet = ss.insertSheet(sheetName);
  }

  // 日付一覧・時刻一覧を取得
  const dates    = s1.dates.map(d => d.date);
  const duration = s1.slotDuration || 15;

  // 時刻一覧（全日程の時刻を統合して昇順ソート）
  const timeSet = new Set();
  s1.dates.forEach(d => {
    let m = timeToMinGs(d.start);
    while (m < timeToMinGs(d.end)) {
      timeSet.add(minToTime(m));
      m += duration;
    }
  });
  const times = [...timeSet].sort();

  // 生徒の割り当てMapを作成
  // key: '2026-04-20_14:30' → value: '3・田中'
  const slotMap = {};
  students.forEach(s => {
    if (s._assignedSlot && s.treatment !== 'none') {
      slotMap[s._assignedSlot] = `${s.number}・${s.lastName}`; // ② 「番」→「・」
    }
  });

  // ヘッダー行を生成
  // A1に「◯年◯組」、B1以降に日付を表示
  const headerRow = [`${grade}年${klass}組`]; // ① A1に学年・組を表示
  dates.forEach(d => {
    headerRow.push(formatDateJaGs(d));
  });

  // データ行を生成（時刻ごと）
  const rows = [headerRow];
  times.forEach(time => {
    const row = [time]; // A列：時刻
    dates.forEach(d => {
      const key  = `${d}_${time}`;
      row.push(slotMap[key] || ''); // 空きコマは空白
    });
    rows.push(row);
  });

  // シートに一括書き込み
  const range = sheet.getRange(1, 1, rows.length, rows[0].length);
  range.setValues(rows);

  // ③ 全セルを中央揃え（水平・垂直）
  range.setHorizontalAlignment('center');
  range.setVerticalAlignment('middle');

  // 書式設定
  // ヘッダー行：太字・背景色
  const headerRange = sheet.getRange(1, 1, 1, rows[0].length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#E8F4FD');

  // A列（時刻列）：太字
  sheet.getRange(1, 1, rows.length, 1).setFontWeight('bold');

  // 列幅の調整
  sheet.setColumnWidth(1, 60);  // 時刻列
  for (let i = 2; i <= dates.length + 1; i++) {
    sheet.setColumnWidth(i, 120); // 日付列
  }

  // 枠線を引く
  range.setBorder(true, true, true, true, true, true);

  // シートタブを水色に設定（既存シートと区別しやすくする）
  sheet.setTabColor('#4A90D9');

  return JSON.stringify({ success: true, sheetName });
}

// ============================================
// 画面4：全クラスの時間割シートを一括出力する
//
// 呼び出し元：index.htmlの outputAllClasses()
// 引数：jsonStr = { '1-1': [students], '1-2': [students], ... }
// ============================================
function outputAllClassSheets(jsonStr) {
  const allData = JSON.parse(jsonStr);

  const results = [];
  Object.keys(allData).forEach(classKey => {
    const students = allData[classKey];
    const result   = outputClassSheet(JSON.stringify({ classKey, students }));
    results.push(JSON.parse(result));
  });

  return JSON.stringify({ success: true, count: results.length });
}

// ============================================
// スプレッドシートのURLを返す（完了ポップアップ用）
// ============================================
function getSpreadsheetUrl() {
  return SpreadsheetApp.getActiveSpreadsheet().getUrl();
}

// ============================================
// ヘルパー：指定時刻の「次のコマの時刻」を返す
// 兄弟姉妹調整のバッファコマ計算に使用
// 例：'15:30' → '15:45'（15分刻みの場合）
// ============================================
function getNextSlotTime(timeStr, duration) {
  const [h, m]   = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m + duration;
  const nh = Math.floor(totalMin / 60);
  const nm = totalMin % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

// フォームIDが保存されているか確認する
function getFormId() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('formId') || '';
}

// フォームURLを返す
function getFormUrl() {
  const props = PropertiesService.getScriptProperties();
  return JSON.stringify({
    publishedUrl: props.getProperty('formUrl')     || '',
    editUrl:      props.getProperty('formEditUrl') || '',
  });
}

// ============================================
// 作業データシートから前回の作業データを復元する
// 画面②の「前回の作業データを復元する」ボタンから呼ばれる
// ============================================
function loadWorkSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('作業データ（編集不要）');
  if (!sheet) {
    return JSON.stringify({ error: '作業データが見つかりません。先に「フォームの回答データを読み込む」を実行してください。' });
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return JSON.stringify({ error: '作業データが空です。' });
  }

  const headers = allData[0];
  const rows = allData.slice(1);

  const idx = {
    grade:      headers.indexOf('学年'),
    klass:      headers.indexOf('組'),
    number:     headers.indexOf('番号'),
    lastName:   headers.indexOf('姓'),
    firstName:  headers.indexOf('名'),
    status:     headers.indexOf('状態'),
    sibling:    headers.indexOf('兄弟姉妹情報'),
    topic:      headers.indexOf('話題'),
    memo:       headers.indexOf('メモ'),
    manualFlag: headers.indexOf('手動指定フラグ'),
    treatment:  headers.indexOf('未回答処理'),
    flags:      headers.indexOf('フラグ'),
    flagRed:    headers.indexOf('赤フラグ'),
  };

  const students = rows.map(row => ({
    grade:      String(row[idx.grade] ?? ''),
    klass:      String(row[idx.klass] ?? ''),
    number:     String(row[idx.number] ?? ''),
    lastName:   String(row[idx.lastName] ?? ''),
    firstName:  String(row[idx.firstName] ?? ''),
    status:     String(row[idx.status] ?? ''),
    sibling:    String(row[idx.sibling] ?? ''),
    topic:      String(row[idx.topic] ?? ''),
    memo:       String(row[idx.memo] ?? ''),
    manualFlag: idx.manualFlag >= 0 ? (row[idx.manualFlag] === true || String(row[idx.manualFlag]) === 'true') : false,
    treatment:  String(row[idx.treatment] ?? ''),
    flags:      idx.flags >= 0 && row[idx.flags] ? String(row[idx.flags]).split(',').filter(Boolean) : [],
    flagRed:    idx.flagRed >= 0 ? (row[idx.flagRed] === true || String(row[idx.flagRed]) === 'true') : false,
  }));

  return JSON.stringify({ students });
}

function resetAll() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  Logger.log('リセット完了');
}
