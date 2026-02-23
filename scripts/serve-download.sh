#!/bin/bash
# ═══════════════════════════════════════════════════
#  빌드된 설치파일을 직원이 브라우저로 다운로드할 수 있게
#  간단한 HTTP 서버를 임시로 실행합니다.
#
#  사용법: ./serve-download.sh
#  직원 접속: http://서버IP:9090
# ═══════════════════════════════════════════════════

set -e

PORT=9090
BUNDLE_DIR="/home/diorama/DioraServerConnecter/client/src-tauri/target/release/bundle"
DOWNLOAD_DIR="/tmp/dsc-downloads"

# 다운로드 디렉토리 준비
rm -rf "$DOWNLOAD_DIR"
mkdir -p "$DOWNLOAD_DIR"

# 빌드 결과물 복사
echo "빌드 결과물을 수집합니다..."

# Linux
if ls "$BUNDLE_DIR/deb/"*.deb &>/dev/null; then
    cp "$BUNDLE_DIR/deb/"*.deb "$DOWNLOAD_DIR/"
    echo "  ✓ Linux .deb"
fi
if ls "$BUNDLE_DIR/appimage/"*.AppImage &>/dev/null; then
    cp "$BUNDLE_DIR/appimage/"*.AppImage "$DOWNLOAD_DIR/"
    echo "  ✓ Linux .AppImage"
fi
if ls "$BUNDLE_DIR/rpm/"*.rpm &>/dev/null; then
    cp "$BUNDLE_DIR/rpm/"*.rpm "$DOWNLOAD_DIR/"
    echo "  ✓ Linux .rpm"
fi

# Windows (if cross-built or copied here)
if ls "$BUNDLE_DIR/nsis/"*.exe &>/dev/null; then
    cp "$BUNDLE_DIR/nsis/"*.exe "$DOWNLOAD_DIR/"
    echo "  ✓ Windows .exe"
fi

# macOS (if cross-built or copied here)
if ls "$BUNDLE_DIR/dmg/"*.dmg &>/dev/null; then
    cp "$BUNDLE_DIR/dmg/"*.dmg "$DOWNLOAD_DIR/"
    echo "  ✓ macOS .dmg"
fi

# HTML 인덱스 페이지 생성
cat > "$DOWNLOAD_DIR/index.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DioraServerConnecter 다운로드</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .container { max-width: 600px; width: 100%; padding: 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #60a5fa; }
  .subtitle { color: #94a3b8; margin-bottom: 2rem; font-size: 0.9rem; }
  .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid #334155; }
  .card h2 { font-size: 1.1rem; margin-bottom: 1rem; }
  .file-list { list-style: none; }
  .file-list li { margin-bottom: 0.75rem; }
  .file-list a { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #0f172a; border-radius: 8px; color: #60a5fa; text-decoration: none; transition: background 0.2s; }
  .file-list a:hover { background: #1e3a5f; }
  .icon { font-size: 1.5rem; }
  .info { flex: 1; }
  .info .name { font-weight: 600; }
  .info .desc { font-size: 0.8rem; color: #94a3b8; }
  .steps { background: #1e293b; border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; }
  .steps h2 { font-size: 1.1rem; margin-bottom: 1rem; }
  .steps ol { padding-left: 1.5rem; }
  .steps li { margin-bottom: 0.5rem; color: #cbd5e1; }
</style>
</head>
<body>
<div class="container">
  <h1>DioraServerConnecter</h1>
  <p class="subtitle">개발 서버 원격 접속 클라이언트</p>

  <div class="card">
    <h2>다운로드</h2>
    <ul class="file-list" id="files"></ul>
    <p id="no-files" style="color:#94a3b8; display:none;">빌드된 파일이 없습니다.</p>
  </div>

  <div class="steps">
    <h2>설치 후 사용 방법</h2>
    <ol>
      <li>다운로드 받은 파일을 실행하여 설치</li>
      <li>앱 실행 → 설정에서 서버 주소 입력</li>
      <li>관리자에게 받은 ID/PW로 로그인</li>
      <li>기기 승인 대기 (관리자 승인 필요)</li>
      <li>승인 후 VS Code 연결 / 터미널 사용</li>
    </ol>
  </div>
</div>
<script>
const icons = { '.exe': '🪟', '.dmg': '🍎', '.deb': '🐧', '.rpm': '🐧', '.AppImage': '🐧' };
const descs = { '.exe': 'Windows 설치파일 (더블클릭)', '.dmg': 'macOS 설치파일 (드래그 앤 드롭)', '.deb': 'Ubuntu/Debian (dpkg -i)', '.rpm': 'Fedora/RHEL (rpm -i)', '.AppImage': 'Linux 범용 (chmod +x 후 실행)' };

fetch('./')
  .then(r => r.text())
  .then(html => {
    const links = [...html.matchAll(/href="([^"]+\.(exe|dmg|deb|rpm|AppImage))"/g)];
    const list = document.getElementById('files');
    if (links.length === 0) { document.getElementById('no-files').style.display = 'block'; return; }
    links.forEach(m => {
      const file = m[1];
      const ext = '.' + file.split('.').pop();
      const li = document.createElement('li');
      li.innerHTML = `<a href="${file}"><span class="icon">${icons[ext]||'📦'}</span><span class="info"><span class="name">${file}</span><br><span class="desc">${descs[ext]||''}</span></span></a>`;
      list.appendChild(li);
    });
  });
</script>
</body>
</html>
HTMLEOF

echo ""
echo "═══════════════════════════════════════════════════"
echo "  다운로드 서버 시작: http://0.0.0.0:$PORT"
echo ""
echo "  직원에게 아래 주소를 알려주세요:"
echo "  → http://$(hostname -I | awk '{print $1}'):$PORT"
echo ""
echo "  Ctrl+C로 종료"
echo "═══════════════════════════════════════════════════"
echo ""

cd "$DOWNLOAD_DIR"
python3 -m http.server "$PORT" --bind 0.0.0.0
