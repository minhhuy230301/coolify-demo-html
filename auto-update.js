const { Octokit } = require("octokit");
require("dotenv").config();

// --- CẤU HÌNH THÔNG TIN CỦA BẠN ---
// 1. Thông tin GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || "minhhuy230301"; // Thay bằng username của bạn nếu chưa set env
const REPO = process.env.GITHUB_REPO || "coolify-demo-html"; // Thay bằng tên repo của bạn
console.log(
  "🔑 Token đang dùng:",
  GITHUB_TOKEN ? GITHUB_TOKEN.substring(0, 10) + "..." : "KHÔNG TÌM THẤY!"
);
// 2. Cấu hình Webhook Coolify (Dán link Deploy Webhook vào đây)
const COOLIFY_WEBHOOKS = {
  main: "https://46e4ba43f8a7.ngrok-free.app/api/v1/deploy?uuid=fw4swkc888400sww4cocoo8w&force=false",
  // Ví dụ: https://abcd.ngrok-free.app/api/v1/deploy?uuid=...

  "mini-gem":
    "https://46e4ba43f8a7.ngrok-free.app/api/v1/deploy?uuid=fw4swkc888400sww4cocoo8w&force=false",
  // Ví dụ: https://abcd.ngrok-free.app/api/v1/deploy?uuid=... (UUID khác cái trên)
};
// ---------------------------------------

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const FILE_PATH = "index.html";

// Lấy nhánh từ dòng lệnh (mặc định là main nếu không nhập)
// Cách chạy: node auto-update.js mini-gem
const targetBranch = process.argv[2] || "main";

async function runAutoUpdate() {
  console.log(
    `🤖 Đang khởi động Bot cập nhật cho nhánh: [ ${targetBranch} ]...`
  );

  // Kiểm tra xem có Webhook chưa
  if (
    !COOLIFY_WEBHOOKS[targetBranch] ||
    COOLIFY_WEBHOOKS[targetBranch].includes("DÁN_LINK")
  ) {
    console.warn(
      "⚠️ CẢNH BÁO: Bạn chưa điền Link Webhook trong file script! Code sẽ lên GitHub nhưng Coolify sẽ KHÔNG tự chạy."
    );
  }

  // 1. Tạo nội dung HTML mới
  const randomColor = Math.floor(Math.random() * 16777215).toString(16);
  const time = new Date().toLocaleTimeString("vi-VN");

  // Tùy biến tiêu đề dựa theo nhánh
  const appTitle =
    targetBranch === "main" ? "🏢 BUSINESS APP (MAIN)" : "💎 GEM MINI APP";

  const MCP_SERVER_URL = "https://4c69332c5047.ngrok-free.app/trigger-sync";
  const MINI_APP_IFRAME_URL = "https://2c7489d82851.ngrok-free.app";
  let bodyContent = "";

  if (targetBranch === "main") {
    // 🏢 GIAO DIỆN APP MAIN: Chỉ chứa Iframe
    bodyContent = `
        <h1>🏢 BUSINESS APP (MAIN)</h1>
        <p>Đây là ứng dụng chính (Container).</p>
        <hr style="margin: 30px 0;">
        <p>👇 Dưới đây là Mini App được nhúng từ nhánh khác 👇</p>
        
        <div style="border: 2px solid #764ba2; border-radius: 10px; overflow: hidden; margin: 20px auto; max-width: 800px; height: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <iframe src="${MINI_APP_IFRAME_URL}" width="100%" height="100%" style="border:none;"></iframe>
        </div>
      `;
  } else {
    // 💎 GIAO DIỆN MINI APP: Chứa Nút bấm & Dữ liệu
    bodyContent = `
        <h1>💎 GEM MINI APP</h1>
        
        <div id="data-board" style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; margin: 20px auto; max-width: 400px; display: none;">
            <h3>📊 Dữ liệu từ MCP System</h3>
            <p>Doanh thu: <strong id="rev" style="font-size: 1.2em; color: #ffd700;">---</strong></p>
            <p>User Online: <strong id="users">---</strong></p>
            <small>Cập nhật lúc: <span id="sync-time">---</span></small>
        </div>

        <button onclick="callMCP()" style="padding: 15px 30px; font-size: 18px; cursor: pointer; background: #ff4757; color: white; border: none; border-radius: 50px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
            🔄 SYNC DATA FROM MCP Server
        </button>
        <p id="status-msg" style="margin-top: 10px; font-style: italic; opacity: 0.8;"></p>

        <script>
            async function loadData() {
                try {
                    const res = await fetch('./data.json?t=' + Date.now());
                    if(res.ok) {
                        const data = await res.json();
                        document.getElementById('data-board').style.display = 'block';
                        document.getElementById('rev').innerText = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(data.total_revenue);
                        document.getElementById('users').innerText = data.active_users;
                        document.getElementById('sync-time').innerText = data.last_sync;
                    }
                } catch(e) {}
            }
            async function callMCP() {
                const btn = document.querySelector('button');
                const status = document.getElementById('status-msg');
                btn.disabled = true; btn.innerText = "⏳ Đang gọi MCP...";
                try {
                    const res = await fetch('${MCP_SERVER_URL}', {
                        headers: {
                            "ngrok-skip-browser-warning": "true"
                        }
                    });
                    const result = await res.json();
                    if(result.success) {
                        status.innerText = "✅ MCP đã xử lý! Đang Deploy...";
                        setTimeout(() => { window.location.reload(); }, 15000); 
                    }
                } catch (err) {
                    status.innerText = "❌ Lỗi kết nối MCP!";
                    btn.disabled = false;
                }
            }
            loadData();
        </script>
      `;
  }

  const newHtml = `
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${targetBranch}</title>
      </head>
      <body style="background-color: ${
        targetBranch === "main" ? "#e0c3fc" : "#4cd137"
      }; font-family: sans-serif; text-align: center; padding-top: 20px;">
        ${bodyContent}
      </body>
    </html>
  `;

  // 2. Mã hóa Base64
  const contentEncoded = Buffer.from(newHtml).toString("base64");

  try {
    // 3. Lấy SHA file cũ trên ĐÚNG NHÁNH ĐÓ
    console.log(`🔍 Đang tìm file cũ trên nhánh '${targetBranch}'...`);
    let sha = null;
    try {
      const { data } = await octokit.request(
        `GET /repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
        { ref: targetBranch }
      );
      sha = data.sha;
    } catch (e) {
      console.log("ℹ️ File chưa tồn tại, sẽ tạo mới.");
    }

    // 4. Đẩy code lên GitHub
    console.log("🚀 Đang đẩy code lên GitHub...");
    await octokit.request(`PUT /repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      message: `Auto-update ${targetBranch} at ${time}`,
      content: contentEncoded,
      sha: sha,
      branch: targetBranch, // Quan trọng: Chỉ định nhánh
    });

    console.log("✅ GitHub Update: THÀNH CÔNG!");

    // 5. Gọi Coolify Deploy (Automation)
    const webhookUrl = COOLIFY_WEBHOOKS[targetBranch];
    if (webhookUrl && !webhookUrl.includes("DÁN_LINK")) {
      console.log(`📞 Đang gọi Coolify Deploy cho App '${targetBranch}'...`);
      // Yêu cầu Node.js v18+ để dùng fetch
      const response = await fetch(webhookUrl);
      const result = await response.json();
      console.log("✅ Coolify Response:", result);
    } else {
      console.log("⏭️ Bỏ qua bước gọi Coolify (Chưa cấu hình Webhook).");
    }
  } catch (error) {
    console.error("❌ Lỗi:", error.message);
  }
}

runAutoUpdate();
