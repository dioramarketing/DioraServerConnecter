#!/bin/bash
# ═══════════════════════════════════════════════════
#  DioraServerConnecter - macOS 빌드 스크립트
#  Finder에서 더블클릭하면 자동으로 빌드됩니다
# ═══════════════════════════════════════════════════

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     DioraServerConnecter - macOS 빌드 스크립트      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}[$1/5]${NC} $2"
}

print_ok() {
    echo -e "      ${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "      ${RED}✗${NC} $1"
}

print_warn() {
    echo -e "      ${YELLOW}!${NC} $1"
}

# 프로젝트 루트로 이동
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

print_header
echo "프로젝트 경로: $PROJECT_ROOT"
echo ""

# ─── 1. Xcode Command Line Tools 확인 ───
print_step 1 "Xcode Command Line Tools 확인 중..."
if ! xcode-select -p &>/dev/null; then
    print_warn "Xcode Command Line Tools가 없습니다. 설치합니다..."
    xcode-select --install
    echo ""
    echo "설치 팝업이 나타나면 '설치'를 클릭해주세요."
    echo "설치 완료 후 이 스크립트를 다시 실행해주세요."
    echo ""
    read -p "Enter 키를 누르면 종료합니다..."
    exit 1
fi
print_ok "Xcode CLT OK"
echo ""

# ─── 2. Node.js 확인 ───
print_step 2 "Node.js 확인 중..."
if ! command -v node &>/dev/null; then
    print_warn "Node.js가 설치되어 있지 않습니다."

    # Homebrew 확인/설치
    if ! command -v brew &>/dev/null; then
        print_warn "Homebrew를 먼저 설치합니다..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # Apple Silicon / Intel 대응
        if [[ -f /opt/homebrew/bin/brew ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -f /usr/local/bin/brew ]]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    fi

    brew install node@20
    brew link node@20

    if ! command -v node &>/dev/null; then
        print_error "Node.js 설치에 실패했습니다."
        print_error "https://nodejs.org 에서 수동으로 설치해주세요."
        read -p "Enter 키를 누르면 종료합니다..."
        exit 1
    fi
fi
print_ok "Node.js $(node -v) OK"
echo ""

# ─── 3. Rust 확인 ───
print_step 3 "Rust 확인 중..."

# PATH에 cargo 추가 (이미 설치된 경우)
if [[ -f "$HOME/.cargo/env" ]]; then
    source "$HOME/.cargo/env"
fi

if ! command -v rustc &>/dev/null; then
    print_warn "Rust가 설치되어 있지 않습니다. 자동 설치합니다... (1~2분)"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    source "$HOME/.cargo/env"

    if ! command -v rustc &>/dev/null; then
        print_error "Rust 설치에 실패했습니다."
        read -p "Enter 키를 누르면 종료합니다..."
        exit 1
    fi
fi
print_ok "$(rustc --version) OK"
echo ""

# ─── 4. 의존성 설치 + 빌드 ───
print_step 4 "의존성 설치 중..."
cd "$PROJECT_ROOT/client"

if [[ ! -d "node_modules" ]]; then
    npm install
else
    print_ok "node_modules 존재, 스킵"
fi
echo ""

print_step 5 "DioraServerConnecter 빌드 중... (처음 5~10분, 이후 1~2분)"
echo "      잠시 기다려주세요..."
echo ""

npx tauri build

# ─── 결과 안내 ───
BUNDLE_DIR="$PROJECT_ROOT/client/src-tauri/target/release/bundle"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   빌드 완료!                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  설치 파일 위치:"
echo ""

# DMG 파일
if ls "$BUNDLE_DIR/dmg/"*.dmg &>/dev/null; then
    for f in "$BUNDLE_DIR/dmg/"*.dmg; do
        echo -e "  ${GREEN}[DMG 설치파일]${NC} $f"
        DMG_FILE="$f"
    done
fi

# .app 번들
if ls "$BUNDLE_DIR/macos/"*.app &>/dev/null; then
    for f in "$BUNDLE_DIR/macos/"*.app; do
        echo -e "  ${BLUE}[APP 번들]${NC}     $f"
    done
fi

echo ""
echo "──────────────────────────────────────────────────────"
echo "  DMG 파일을 직원에게 전달하면 더블클릭으로 설치됩니다."
echo "──────────────────────────────────────────────────────"
echo ""

# 결과 폴더 열기
if [[ -d "$BUNDLE_DIR/dmg" ]]; then
    open "$BUNDLE_DIR/dmg"
fi

read -p "Enter 키를 누르면 종료합니다..."
