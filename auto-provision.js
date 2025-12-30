require("dotenv").config();
const { Octokit } = require("octokit");

// --- CẤU HÌNH ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || "minhhuy230301";
const REPO = process.env.GITHUB_REPO || "coolify-demo-html";

// Coolify Config
const API_URL = process.env.COOLIFY_API_URL;
const API_TOKEN = process.env.COOLIFY_API_TOKEN;
const PROJECT_UUID = process.env.COOLIFY_PROJECT_UUID;
const SERVER_UUID = process.env.COOLIFY_SERVER_UUID;
const ENV_NAME = process.env.COOLIFY_ENV_NAME || "production";

// Lấy tham số từ dòng lệnh
const targetBranch = process.argv[2]; // Tên nhánh (VD: feature-1)
const targetPort = process.argv[3]; // Cổng muốn chạy (VD: 3005)

if (!targetBranch || !targetPort) {
  console.error(
    "❌ Thiếu tham số! Cách dùng: node auto-provision.js <tên_nhánh> <cổng_port>"
  );
  console.error("Ví dụ: node auto-provision.js feature-login 3005");
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const headers = {
  Authorization: `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

// Hàm gọi API Coolify
async function callCoolify(method, endpoint, body = null) {
  const options = {
    method: method,
    headers: headers,
  };
  if (body) options.body = JSON.stringify(body);

  // Bypass Ngrok Warning
  options.headers["ngrok-skip-browser-warning"] = "true";

  const res = await fetch(`${API_URL}${endpoint}`, options);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Coolify API Error (${endpoint}): ${err}`);
  }
  return res.json();
}

async function main() {
  console.log(`🤖 BẮT ĐẦU QUY TRÌNH TỰ ĐỘNG HÓA CHO NHÁNH: ${targetBranch}`);

  try {
    // --- BƯỚC 1: XỬ LÝ GITHUB (Tạo nhánh, đẩy code) ---
    console.log("1️⃣  Đang xử lý GitHub...");
    // (Ở đây mình rút gọn: Giả sử bạn đã checkout nhánh và push rồi.
    // Hoặc dùng lại logic push code của file auto-update.js cũ nếu muốn code tự tạo nhánh)

    // --- BƯỚC 2: KIỂM TRA APP TRÊN COOLIFY ---
    console.log("2️⃣  Kiểm tra tài nguyên trên Coolify...");
    const resources = await callCoolify("GET", "/resources");

    // Tìm xem đã có App nào tên giống nhánh chưa
    let existingApp = resources.find(
      (r) =>
        r.git_repository === `${OWNER}/${REPO}` && r.git_branch === targetBranch
    );

    let appUuid = "";

    if (existingApp) {
      console.log(
        `✅ Đã tìm thấy App cho nhánh '${targetBranch}' (UUID: ${existingApp.uuid})`
      );
      appUuid = existingApp.uuid;
    } else {
      console.log(
        `✨ Chưa có App cho nhánh '${targetBranch}'. Đang tạo mới...`
      );

      // --- BƯỚC 3: TẠO APP MỚI (NẾU CHƯA CÓ) ---
      const createPayload = {
        project_uuid: PROJECT_UUID,
        server_uuid: SERVER_UUID,
        environment_name: ENV_NAME,
        git_repository: `${OWNER}/${REPO}`,
        git_branch: targetBranch,
        ports_exposes: `${targetPort}:80`, // Map cổng
        build_pack: "static", // Quan trọng: Chọn Static
        is_static: true,
        name: `auto-${targetBranch}`, // Tên App
      };

      const created = await callCoolify(
        "POST",
        "/applications/public",
        createPayload
      );
      appUuid = created.uuid;
      console.log(`🎉 Đã tạo App mới thành công! UUID: ${appUuid}`);

      // Cấu hình thêm (Static Image)
      console.log("⚙️  Đang cấu hình Docker Image...");
      await callCoolify("PATCH", `/applications/${appUuid}`, {
        static_image: "nginx:alpine",
        ports_exposes: `${targetPort}:80`,
      });
    }

    // --- BƯỚC 4: DEPLOY ---
    console.log(`🚀 Đang kích hoạt Deploy cho App (UUID: ${appUuid})...`);
    const deployRes = await callCoolify("POST", `/deploy?uuid=${appUuid}`);

    console.log("------------------------------------------------");
    console.log(`✅ HOÀN TẤT! Deployment ID: ${deployRes.deployment_uuid}`);
    console.log(`🌍 App sẽ sớm chạy tại: http://localhost:${targetPort}`);
    console.log("------------------------------------------------");
  } catch (error) {
    console.error("❌ LỖI:", error.message);
  }
}

main();
