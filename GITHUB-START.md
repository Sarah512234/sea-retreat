# 上传 GitHub 与开启在线体验

1. 解压 `pixel-sea-window-github.zip`。
2. 在 GitHub 创建 Public 仓库，例如 `sea-retreat`，默认分支使用 `main`。
3. 通过 Add file → Upload files 上传解压后的所有文件和文件夹，然后提交。仓库首页应直接看到 `README.md`、`package.json`、`src` 和 `.github`；不要上传 ZIP 本身，也不要再套一层外部文件夹。
4. 确保 `.github/workflows/pages.yml` 和 `.gitignore` 也已上传。若拖拽上传遗漏点开头的文件，请使用 Add file → Create new file，以完整路径创建文件并复制对应内容。
5. 打开仓库 Settings → Pages，将 Source 设为 GitHub Actions。
6. 打开 Actions → Publish sea retreat → Run workflow，选择 main 并运行。第一次上传可能发生在 Pages 尚未开启时，完成第 5 步后重新运行即可。
7. 运行成功后，在 Settings → Pages 或部署记录中找到网站地址，分享该地址即可。通常为 `https://你的用户名.github.io/仓库名/`。

以后更新 main 分支，工作流先执行测试，通过后发布 `src` 目录。不需要安装 Electron 依赖才能发布网站。声音需要访问者手动开启。

本包包含源码、测试、MIT 许可证和发布配置，不包含旧 ZIP、依赖目录或 Git 历史。尚未上传至任何账号，也未在 GitHub 上实际运行部署。

后续迭代建议用 GitHub Desktop 克隆仓库，在本地修改后 Commit / Push。桌面版的生成文件可以另行放到 GitHub Releases。

官方参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
