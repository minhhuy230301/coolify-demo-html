const { Octokit } = require("octokit");

// --- CẤU HÌNH THÔNG TIN CỦA BẠN ---
// 1. Thông tin GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || "minhhuy230301"; // Thay bằng username của bạn nếu chưa set env
const REPO = process.env.GITHUB_REPO || "coolify-demo-html"; // Thay bằng tên repo của bạn

// 2. Cấu hình Webhook Coolify (Dán link Deploy Webhook vào đây)
const COOLIFY_WEBHOOKS = {
  main: "DÁN_LINK_WEBHOOK_APP_MAIN_CỦA_BẠN_VÀO_ĐÂY",
  // Ví dụ: https://abcd.ngrok-free.app/api/v1/deploy?uuid=...

  "mini-gem": "DÁN_LINK_WEBHOOK_APP_MINI_GEM_VÀO_ĐÂY",
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

  const newHtml = `
    <!DOCTYPE html>
    <html lang="vi"> 
      <head>
        <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${targetBranch} Update</title>
      </head>
      <body style="background-color: #${randomColor}; font-family: sans-serif; text-align: center; padding-top: 50px; transition: 0.5s; color: ${
    targetBranch === "mini-gem" ? "white" : "black"
  }">
        <h1>${appTitle}</h1>
        <h3>Phiên bản cập nhật lúc: ${time}</h3>
        <div style="border: 2px dashed #333; padding: 20px; display: inline-block; background: rgba(255,255,255,0.3); backdrop-filter: blur(5px);">
           Nhánh hiện tại: <strong>${targetBranch}</strong> <br>
           Mã màu: <strong>#${randomColor}</strong>
        </div>
        
        ${
          targetBranch === "main"
            ? `
        <hr style="margin: 30px 0;">
        <p>👇 Dưới đây là Mini App được nhúng (Iframe) 👇</p>
        <iframe src="DÁN_LINK_NGROK_CỔNG_3001_VÀO_ĐÂY" width="90%" height="300" style="border: 2px solid #666; border-radius: 10px;"></iframe>
        `
            : ""
        }
        
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
