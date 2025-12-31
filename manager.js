require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.json());

// --- CẤU HÌNH ---
const PORT = 4000;
const COOLIFY_API_URL = process.env.COOLIFY_API_URL; // http://localhost:8000/api/v1
const COOLIFY_API_TOKEN = process.env.COOLIFY_API_TOKEN;
const COOLIFY_PROJECT_UUID = process.env.COOLIFY_PROJECT_UUID;
const COOLIFY_SERVER_UUID = process.env.COOLIFY_SERVER_UUID;
const COOLIFY_ENV_NAME = process.env.COOLIFY_ENV_NAME || "production";

// 🛡️ BẢO MẬT: Chỉ cho phép các Repo này được tự động deploy
// (Tránh trường hợp người lạ biết link webhook bắn tin bậy bạ)
const ALLOWED_REPOS = ["coolify-demo-html", "du-an-ban-hang", "mini-app-hr"];
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

app.post("/github-webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  if (event !== "push") return res.status(200).send("Not a push event.");

  const payload = req.body;

  // 1. LẤY THÔNG TIN ĐỘNG TỪ GITHUB GỬI SANG
  // GitHub luôn gửi kèm thông tin Repo trong payload
  const currentRepoName = payload.repository.name; // VD: coolify-demo-html
  const currentOwner = payload.repository.owner.login; // VD: minhhuy230301
  const branchName = payload.ref.replace("refs/heads/", "");

  console.log(
    `🔔 CÓ BIẾN! Repo: [${currentRepoName}] - Nhánh: [${branchName}]`
  );

  // 2. KIỂM TRA BẢO MẬT (WHITELIST)
  if (!ALLOWED_REPOS.includes(currentRepoName)) {
    console.log(
      `⛔ Repo '${currentRepoName}' không nằm trong danh sách cho phép. Bỏ qua.`
    );
    return res.status(403).send("Repo not allowed.");
  }

  try {
    const resources = await callCoolify("GET", "/resources");

    // 3. TÌM KIẾM APP DỰA TRÊN CẢ TÊN REPO VÀ NHÁNH
    const existingApp = resources.find(
      (r) =>
        r.git_repository?.includes(
          `github.com/${currentOwner}/${currentRepoName}`
        ) && r.git_branch === branchName
    );

    if (existingApp) {
      console.log(
        `♻️ App đã tồn tại (UUID: ${existingApp.uuid}). Redeploying...`
      );
      await callCoolify("POST", `/deploy?uuid=${existingApp.uuid}`);
      console.log(`✅ Đã gửi lệnh Redeploy.`);
    } else {
      console.log(
        `✨ Chưa có App cho '${currentRepoName}/${branchName}'. Khởi tạo...`
      );

      // Tạo tên App duy nhất: auto-TÊNREPO-TÊNNHÁNH
      // VD: auto-coolify-demo-html-hieu-phan-5
      let safeRepoName = currentRepoName
        .replace(/[^a-zA-Z0-9-]/g, "-")
        .toLowerCase();
      let safeBranchName = branchName
        .replace(/[^a-zA-Z0-9-]/g, "-")
        .toLowerCase();

      const uniqueAppName = `auto-${safeRepoName}-${safeBranchName}`;

      const uniqueSlug = `${safeRepoName.slice(0, 20)}-${safeBranchName.slice(
        0,
        30
      )}`;
      const uniqueDomain = `https://${uniqueSlug}.my-project.com`;

      const createPayload = {
        project_uuid: COOLIFY_PROJECT_UUID,
        server_uuid: COOLIFY_SERVER_UUID,
        environment_name: COOLIFY_ENV_NAME,

        git_repository: `https://github.com/${currentOwner}/${currentRepoName}`,
        git_branch: branchName,

        ports_exposes: "80",
        build_pack: "dockerfile",

        // 👉 Dùng Tên App đã ghép tên Repo
        name: uniqueAppName,
      };

      const created = await callCoolify(
        "POST",
        "/applications/public",
        createPayload
      );
      const appUuid = created.uuid;

      // Cấu hình Port ngẫu nhiên
      const randomPort = Math.floor(Math.random() * (5000 - 4000 + 1) + 4000);
      console.log(`⚙️  Cấu hình Port: ${randomPort} cho ${uniqueAppName}...`);

      try {
        // Cố gắng set Domain (Nếu API cho phép)
        await callCoolify("PATCH", `/applications/${appUuid}`, {
          ports_exposes: "80",
          fqdn: uniqueDomain,
        });
      } catch (e) {
        console.warn(
          "⚠️ API không cho set Domain tự động (Lỗi Beta). Đang chuyển sang chế độ Port Mapping..."
        );

        // 2. FALLBACK: Nếu set Domain lỗi, ta map Port thủ công
        // Đây là "phao cứu sinh" giúp App vẫn chạy được
        await callCoolify("PATCH", `/applications/${appUuid}`, {
          ports_exposes: "80",
          // Map cổng 80 trong container ra cổng Random ngoài Server
          custom_docker_run_options: `--publish ${randomPort}:80`,
        });
      }

      console.log(`🚀 Deploying...`);
      await callCoolify("POST", `/deploy?uuid=${appUuid}`);
      console.log(`✅ HOÀN TẤT! App: ${uniqueAppName}`);
    }

    res.status(200).send("Processed");
  } catch (error) {
    console.error("❌ Lỗi:", error.message);
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => {
  console.log(`🤖 TỔNG QUẢN LÝ đang lắng nghe tại cổng ${PORT}...`);
});
