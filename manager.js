require("dotenv").config();
const express = require("express");
const { Octokit } = require("octokit");

const app = express();
app.use(express.json()); // Để đọc JSON từ GitHub gửi sang

// --- CẤU HÌNH ---
const PORT = 4000; // Bot này chạy cổng 4000
const COOLIFY_API_URL = process.env.COOLIFY_API_URL;
const COOLIFY_API_TOKEN = process.env.COOLIFY_API_TOKEN;
const COOLIFY_PROJECT_UUID = process.env.COOLIFY_PROJECT_UUID;
const COOLIFY_SERVER_UUID = process.env.COOLIFY_SERVER_UUID;
const COOLIFY_ENV_NAME = process.env.COOLIFY_ENV_NAME || "production";
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
// ----------------

// Hàm gọi API Coolify
async function callCoolify(method, endpoint, body = null) {
  const headers = {
    Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${COOLIFY_API_URL}${endpoint}`, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Route nhận tin từ GitHub
app.post("/github-webhook", async (req, res) => {
  const event = req.headers["x-github-event"];

  // Chỉ quan tâm sự kiện PUSH
  if (event !== "push") {
    return res.status(200).send("Not a push event, ignored.");
  }

  const payload = req.body;
  // Lấy tên nhánh từ ref (VD: "refs/heads/feature-abc" -> "feature-abc")
  const branchName = payload.ref.replace("refs/heads/", "");

  // Bỏ qua nhánh main nếu bạn muốn (hoặc xử lý luôn cũng được)
  // if (branchName === 'main') return res.send('Skip main');

  console.log(`🔔 CÓ BIẾN! Phát hiện push code vào nhánh: [ ${branchName} ]`);

  try {
    // 1. Kiểm tra xem App này đã tồn tại trên Coolify chưa
    const resources = await callCoolify("GET", "/resources");
    const existingApp = resources.find(
      (r) =>
        r.git_repository?.includes(`${OWNER}/${REPO}`) &&
        r.git_branch === branchName
    );

    if (existingApp) {
      // --- TRƯỜNG HỢP 1: APP ĐÃ CÓ -> REDEPLOY ---
      console.log(`♻️ App '${branchName}' đã tồn tại. Đang redeploy...`);
      await callCoolify("POST", `/deploy?uuid=${existingApp.uuid}`);
      console.log(`✅ Đã gửi lệnh Redeploy.`);
    } else {
      // --- TRƯỜNG HỢP 2: APP CHƯA CÓ -> TẠO MỚI ---
      console.log(`✨ Nhánh mới '${branchName}' chưa có App. Đang khởi tạo...`);

      // Random cổng từ 4000 đến 5000 để tránh đụng hàng
      const randomPort = Math.floor(Math.random() * (5000 - 4000 + 1) + 4000);

      const createPayload = {
        project_uuid: COOLIFY_PROJECT_UUID,
        server_uuid: COOLIFY_SERVER_UUID,
        environment_name: COOLIFY_ENV_NAME,

        // Link Git đã sửa đúng
        git_repository: `https://github.com/${OWNER}/${REPO}`,
        git_branch: branchName,

        // ❌ XÓA DÒNG NÀY ĐI (Nguyên nhân gây lỗi format)
        ports_exposes: String(randomPort) + ":80",

        build_pack: "static",
        is_static: true,

        // ✅ SỬA TÊN APP: Thay dấu '/' thành '-' (Ví dụ: feat/login -> auto-feat-login)
        // Để tránh lỗi tên Container không hợp lệ
        name: `auto-${branchName.replace(/\//g, "-")}`,
      };

      const created = await callCoolify(
        "POST",
        "/applications/public",
        createPayload
      );
      const appUuid = created.uuid;

      // --- CẤU HÌNH PORT Ở BƯỚC NÀY (An toàn hơn) ---
      console.log(`⚙️  Đang cấu hình Port ${randomPort}...`);
      await callCoolify("PATCH", `/applications/${appUuid}`, {
        static_image: "nginx:alpine",
        ports_exposes: `${randomPort}:80`,
      });

      // Deploy lần đầu
      console.log(`🚀 Đang deploy App mới trên cổng ${randomPort}...`);
      await callCoolify("POST", `/deploy?uuid=${appUuid}`);
      console.log(`✅ HOÀN TẤT! App mới sẽ chạy tại port: ${randomPort}`);
    }

    res.status(200).send("Processed");
  } catch (error) {
    console.error("❌ Lỗi xử lý:", error.message);
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => {
  console.log(`🤖 MANAGER BOT đang lắng nghe tại cổng ${PORT}...`);
});
