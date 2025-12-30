require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Octokit } = require("octokit");

const app = express();
app.use(cors()); // Cho phép Mini App gọi vào mà không bị chặn

// --- CẤU HÌNH ---
const PORT = 3002; // Chạy ở cổng 3002
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || "minhhuy230301";
const REPO = process.env.GITHUB_REPO || "coolify-demo-html";
const BRANCH = "mini-gem"; // File json sẽ nằm ở nhánh Mini App
const FILE_PATH = "data.json"; // Tên file dữ liệu
// ----------------

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// API để Mini App gọi vào
app.get("/trigger-sync", async (req, res) => {
  console.log("📡 Nhận lệnh SYNC từ Mini App...");

  // 1. Giả lập dữ liệu từ MCP (Random doanh số, user...)
  const fakeData = {
    last_sync: new Date().toLocaleString("vi-VN"),
    total_revenue: Math.floor(Math.random() * 1000000000), // Random doanh thu
    active_users: Math.floor(Math.random() * 5000),
    status: "SUCCESS",
    message: "Dữ liệu đã được MCP xử lý và đẩy về GitHub",
  };

  const contentEncoded = Buffer.from(
    JSON.stringify(fakeData, null, 2)
  ).toString("base64");

  try {
    // 2. Lấy SHA file cũ (nếu có) để ghi đè
    let sha = null;
    try {
      const { data } = await octokit.request(
        `GET /repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
        { ref: BRANCH }
      );
      sha = data.sha;
    } catch (e) {
      /* File chưa có thì thôi */
    }

    // 3. Đẩy file JSON lên GitHub
    await octokit.request(`PUT /repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      message: `MCP System Auto-sync: ${fakeData.last_sync}`,
      content: contentEncoded,
      sha: sha,
      branch: BRANCH,
    });

    console.log("✅ Đã đẩy data.json lên GitHub!");

    // Trả về kết quả cho nút bấm biết là xong
    res.json({ success: true, data: fakeData });
  } catch (error) {
    console.error("❌ Lỗi:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🤖 Fake MCP Server đang chạy tại: http://localhost:${PORT}`);
});
