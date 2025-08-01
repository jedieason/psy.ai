import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';
const firebaseConfig = {
    apiKey: "AIzaSyChdYY6AdKToEyv194bJOdAIx00ykRCtDE",
    authDomain: "geminiapiformedbot.firebaseapp.com",
    databaseURL: "https://geminiapiformedbot-default-rtdb.firebaseio.com",
    projectId: "geminiapiformedbot",
    storageBucket: "geminiapiformedbot.firebasestorage.app",
    messagingSenderId: "520520790517",
    appId: "1:520520790517:web:24f30bf0b9999dafdbb0bc",
    measurementId: "G-BCJJ36CS4S"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let selectedLang = "zh";

let conversationHistory = [];

async function sendFinalMedicalReport(finalReport) {
    console.log("🚑 [DEBUG] Received finalReport ▼\n", finalReport);
    const reportObject = {
        "姓名": "",
        "就診原因／醫師協助期待": "",
        "情緒／睡眠／自律神經症狀及持續時間": "",
        "壓力或影響情緒事件經過": "",
        "其他不舒服症狀": "",
        "既往內科慢性病史（如氣喘、糖尿病、高血壓、肝炎等）": "",
        "居住狀況與家庭組成": "",
        "吸菸／飲酒／檳榔／其他物質習慣及平均每日用量": "",
        "其他想告訴醫師事項": "",
        "初步診斷": ""
    };

    let xmlString = null;
    const directXML = finalReport.trim().startsWith('<');
    if (directXML) {
        xmlString = finalReport.trim();
    } else {
        const startIdx = finalReport.indexOf("<medical_record");
        const endIdx = finalReport.indexOf("</medical_record>");
        if (startIdx !== -1 && endIdx !== -1) {
            xmlString = finalReport.slice(startIdx, endIdx + "</medical_record>".length);
        }
    }

    if (xmlString) {
        console.log("📄 [DEBUG] Extracted XML ▼\n", xmlString);
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "application/xml");
            const xmlToObjectKey = {
                "姓名": "姓名",
                "就診原因_醫師協助期待": "就診原因／醫師協助期待",
                "情緒_睡眠_自律神經症狀及持續時間": "情緒／睡眠／自律神經症狀及持續時間",
                "壓力或影響情緒事件經過": "壓力或影響情緒事件經過",
                "其他不舒服症狀": "其他不舒服症狀",
                "既往內科慢性病史": "既往內科慢性病史（如氣喘、糖尿病、高血壓、肝炎等）",
                "居住狀況與家庭組成": "居住狀況與家庭組成",
                "物質使用習慣_平均每日用量": "吸菸／飲酒／檳榔／其他物質習慣及平均每日用量",
                "其他想告訴醫師事項": "其他想告訴醫師事項",
                "初步診斷": "初步診斷"
            };

            Object.entries(xmlToObjectKey).forEach(([tag, key]) => {
                const elem = xmlDoc.getElementsByTagName(tag)[0];
                if (elem && elem.textContent != null) {
                    reportObject[key] = elem.textContent.trim();
                }
            });
        } catch (xmlErr) {
            console.error("XML 解析錯誤:", xmlErr);
        }
    }

    if (!xmlString) {
        const lines = finalReport.split('\n');
        lines.forEach(line => {
            const parts = line.split(/：|:/);
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(parts[0].includes('：') ? '：' : ':').trim();

                if (reportObject.hasOwnProperty(key)) {
                    reportObject[key] = value;
                }
            }
        });
    }

    console.log("🩺 [DEBUG] Parsed reportObject ▼\n", reportObject);

    const 時間戳 = Date.now();
    const 姓名_值 = reportObject["姓名"] || "未知姓名";
    const 病歷識別碼 = `${時間戳}｜${姓名_值}`;

    try {
        const reportRef = ref(database, `medical_reports/${病歷識別碼}`);
        await set(reportRef, reportObject);
        console.log(`醫療報告已成功儲存到 Firebase。路徑: medical_reports/${病歷識別碼} 💯`);
        console.log("儲存的資料：", reportObject);

    } catch (error) {
        console.error('儲存醫療報告到 Firebase 時發生錯誤:', error);
        if (typeof sendErrorReport === 'function') {
            sendErrorReport(new Error(`Firebase 儲存錯誤: ${error.message} (病歷識別碼: ${病歷識別碼})`));
        }
    }
}

async function initializeChat(initialMessage) {
    const chatLog = document.getElementById("chat-log");
    const loadingMsgDiv = document.createElement("div");
    loadingMsgDiv.className = "assistant-message loading";
    loadingMsgDiv.innerHTML = '<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
    chatLog.appendChild(loadingMsgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
    try {
        const response = await fetch("https://us-central1-geminiapiformedbot.cloudfunctions.net/geminiFunction", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversation: [
                    {
                        role: 'user',
                        content: [{ text: initialMessage }]
                    }
                ],
                lang: selectedLang
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 呼叫錯誤 (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        chatLog.removeChild(loadingMsgDiv);
        const welcomeMessage = data.response.trim();
        
        conversationHistory.push({ role: "assistant", message: welcomeMessage });
        
        const welcomeMsgDiv = document.createElement("div");
        welcomeMsgDiv.className = "assistant-message";
        welcomeMsgDiv.textContent = welcomeMessage;
        chatLog.appendChild(welcomeMsgDiv);
        
        return welcomeMessage;
    } catch (error) {
        chatLog.removeChild(loadingMsgDiv);
        console.error("初始化錯誤:", error);
        sendErrorReport(error);
        const errorMsgDiv = document.createElement("div");
        errorMsgDiv.className = "error-message";
        errorMsgDiv.textContent = `初始化錯誤: ${error.message}`;
        chatLog.appendChild(errorMsgDiv);
        return "您好，請問有什麼能幫您的嗎？";
    }
}

window.sendMessage = async function (userMessage) {
    conversationHistory.push({ role: "user", message: userMessage });
    
    try {
        const historyForAPI = conversationHistory.filter((msg, idx) => {
            if (idx === 0 && msg.role === "assistant") {
                return false;
            }
            return true;
        });
        
        const formattedConversation = historyForAPI.map(msg => ({
            role: msg.role, 
            content: [{ text: msg.message }]
        }));
        
        console.log("發送到後端的對話歷史:", JSON.stringify(formattedConversation));
        
        const response = await fetch("https://us-central1-geminiapiformedbot.cloudfunctions.net/geminiFunction", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversation: formattedConversation,
                lang: selectedLang
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 呼叫錯誤 (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        const trimmedResponse = data.response.trim();

        if (trimmedResponse.includes("<medical_record") || trimmedResponse.includes("病歷簡介：")) {
            const thankMsgZh = "感謝您提供完整資訊，我們已完成資料整理。";
            const thankMsgEn = "Thank you for providing all the information. We've finished processing your data.";

            const waitingHtmlZh = '<p>感謝您提供完整資訊，請稍待片刻等待就診。另外在候位之餘想邀請您<a href="https://forms.gle/Ema6yXHhNHZ6dB6x6" target="_blank">點此</a>回饋您的使用體驗！</p>';
            const waitingHtmlEn = '<p>Thank you for providing all the information. Please wait while we arrange your consultation. Meanwhile, feel free to <a href="https://forms.gle/UrJjiA98sL4FzsKs9" target="_blank">leave feedback about your experience here</a>!</p>';

            const thankDisplay = selectedLang === "en" ? thankMsgEn : thankMsgZh;
            const waitingHtml   = selectedLang === "en" ? waitingHtmlEn : waitingHtmlZh;
            const shortReturn   = selectedLang === "en" ? "Thank you!" : "感謝您！";

            conversationHistory.push({ role: "assistant", message: thankDisplay });
            sendFinalMedicalReport(trimmedResponse);

            const inputArea = document.getElementById("input-area");
            inputArea.innerHTML = waitingHtml;

            return shortReturn;
        } else {
            conversationHistory.push({ role: "assistant", message: trimmedResponse });
            return trimmedResponse;
        }
    } catch (error) {
        console.error("錯誤：", error);
        const formattedReport = sendErrorReport(error);
        return formattedReport;
    }
};

document.getElementById("sendButton").addEventListener("click", async () => {
    const userMessageInput = document.getElementById("userMessage");
    const chatLog = document.getElementById("chat-log");
    const userMessage = userMessageInput.value.trim();
    if (!userMessage) return;

    const userMsgDiv = document.createElement("div");
    userMsgDiv.className = "user-message";
    userMsgDiv.textContent = userMessage;
    chatLog.appendChild(userMsgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
    userMessageInput.value = "";

    const loadingMsgDiv = document.createElement("div");
    loadingMsgDiv.className = "assistant-message loading";
    loadingMsgDiv.innerHTML = '<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
    chatLog.appendChild(loadingMsgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
        const assistantResponse = await window.sendMessage(userMessage);
        chatLog.removeChild(loadingMsgDiv);
        
        const assistantMsgDiv = document.createElement("div");
        assistantMsgDiv.className = "assistant-message";
        assistantMsgDiv.textContent = assistantResponse;
        chatLog.appendChild(assistantMsgDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    } catch (error) {
        sendErrorReport(error);
        chatLog.removeChild(loadingMsgDiv);
        
        const errorMsgDiv = document.createElement("div");
        errorMsgDiv.className = "error-message";
        errorMsgDiv.textContent = `錯誤：${error.message}`;
        chatLog.appendChild(errorMsgDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const langScreen = document.getElementById("language-screen");
    const chatContainer = document.getElementById("chat-container");
    const btnZh = document.getElementById("btn-chinese");
    const btnEn = document.getElementById("btn-english");

    btnZh.addEventListener("click", async () => {
        selectedLang = "zh";
        langScreen.style.display = "none";
        chatContainer.style.display = "flex";
        document.getElementById("userMessage").placeholder = "請輸入訊息⋯";
        document.getElementById("sendButton").textContent  = "傳送";
        await initializeChat("系統語言設定：僅使用正體中文（臺灣）回答。");
    });

    btnEn.addEventListener("click", async () => {
        selectedLang = "en";
        langScreen.style.display = "none";
        chatContainer.style.display = "flex";
        document.getElementById("userMessage").placeholder = "Type your message...";
        document.getElementById("sendButton").textContent  = "SEND";
        await initializeChat("Language setting: only answer with English");
    });
});

const userMessageInput = document.getElementById("userMessage");
userMessageInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        document.getElementById("sendButton").click();
    }
});

function sendErrorReport(error) {
    const now = new Date();
    const timestamp = now.toLocaleString('zh-TW', { hour12: false });
    
    const historyText = conversationHistory
        .map((msg, idx) => `${idx + 1}. 【${msg.role === 'user' ? '使用者' : '助理'}】 ${msg.message}`)
        .join('\n');

    const reportContent = [
        '===== 錯誤回報 =====',
        `時間：${timestamp}`,
        `錯誤訊息：${error.message}`,
        '',
        '----- 完整對話歷史 -----',
        historyText,
        '====================='
    ].join('\n');

    const url = 'https://script.google.com/macros/s/AKfycbypoBJyxKh436VSYk_PFyaWoVuK-BuBezOCkxuhhm28GcR68jHwMyIHK7EG5Gge_SCfhQ/exec';
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ content: reportContent })
    })
    .then(res => res.text())
    .then(resText => {
        console.log('已回報錯誤：', resText);
    })
    .catch(reportError => {
        console.error('回報錯誤時發生問題：', reportError);
    });

    return reportContent;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/yoursclinic.chat/sw.js')
      .then(reg => {
        console.log('Service Worker 註冊成功：', reg);
      })
      .catch(err => {
        console.error('Service Worker 註冊失敗：', err);
      });
  });
}
