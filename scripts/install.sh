#!/bin/sh
# LazyReview installer script
# Usage:
#   curl -sSL https://raw.githubusercontent.com/tauantcamargo/lazyreview/main/scripts/install.sh | sh
#   curl -sSL .../install.sh | sh -s -- --method apt

set -e

REPO="tauantcamargo/lazyreview"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
METHOD="${METHOD:-auto}" # auto|tar|apt|rpm
PINNED_TAG=""

usage() {
    cat <<EOF
Usage: install.sh [options]

Options:
  --method <auto|tar|apt|rpm>  Install method (default: auto)
  --version <tag>              Install specific tag (e.g. v0.45.0)
  --install-dir <path>         Binary install dir for tar method (default: /usr/local/bin)
  -h, --help                   Show this help message
EOF
}

run_as_root() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    else
        if command -v sudo >/dev/null 2>&1; then
            sudo "$@"
        else
            echo "This step requires root privileges and 'sudo' is not available."
            exit 1
        fi
    fi
}

while [ $# -gt 0 ]; do
    case "$1" in
        --method)
            METHOD="$2"
            shift 2
            ;;
        --version)
            PINNED_TAG="$2"
            shift 2
            ;;
        --install-dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
    x86_64)
        ARCH="amd64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    *)
        echo "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

case "$OS" in
    linux|darwin)
        ;;
    mingw*|msys*|cygwin*)
        OS="windows"
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

if [ -n "$PINNED_TAG" ]; then
    LATEST="$PINNED_TAG"
else
    echo "Fetching latest version..."
    LATEST=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
fi

if [ -z "$LATEST" ]; then
    echo "Could not determine version"
    exit 1
fi

VERSION="${LATEST#v}"
echo "Installing LazyReview $LATEST"

if [ "$METHOD" = "auto" ]; then
    if [ "$OS" = "linux" ] && command -v apt-get >/dev/null 2>&1; then
        METHOD="apt"
    elif [ "$OS" = "linux" ] && (command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1); then
        METHOD="rpm"
    else
        METHOD="tar"
    fi
fi

TMPDIR=$(mktemp -d)
cleanup() {
    rm -rf "$TMPDIR"
}
trap cleanup EXIT

cd "$TMPDIR"

download_asset() {
    FILE="$1"
    URL="https://github.com/$REPO/releases/download/$LATEST/$FILE"
    echo "Downloading $URL..."
    curl -fsSLO "$URL"
}

install_from_tar() {
    if [ "$OS" = "windows" ]; then
        FILE="lazyreview_${VERSION}_${OS}_${ARCH}.zip"
        download_asset "$FILE"
        unzip -q "$FILE"
    else
        FILE="lazyreview_${VERSION}_${OS}_${ARCH}.tar.gz"
        download_asset "$FILE"
        tar -xzf "$FILE"
    fi

    echo "Installing to $INSTALL_DIR..."
    if mkdir -p "$INSTALL_DIR" 2>/dev/null && [ -w "$INSTALL_DIR" ]; then
        mv lazyreview "$INSTALL_DIR/"
    else
        run_as_root mkdir -p "$INSTALL_DIR"
        run_as_root mv lazyreview "$INSTALL_DIR/"
    fi
}

install_from_apt() {
    if [ "$OS" != "linux" ]; then
        echo "--method apt is only supported on Linux."
        exit 1
    fi
    if ! command -v apt-get >/dev/null 2>&1; then
        echo "apt-get not found."
        exit 1
    fi
    FILE="lazyreview_${VERSION}_linux_${ARCH}.deb"
    download_asset "$FILE"
    echo "Installing via apt-get..."
    run_as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y "./$FILE"
}

install_from_rpm() {
    if [ "$OS" != "linux" ]; then
        echo "--method rpm is only supported on Linux."
        exit 1
    fi
    FILE="lazyreview_${VERSION}_linux_${ARCH}.rpm"
    download_asset "$FILE"

    if command -v dnf >/dev/null 2>&1; then
        echo "Installing via dnf..."
        run_as_root dnf install -y "./$FILE"
    elif command -v yum >/dev/null 2>&1; then
        echo "Installing via yum..."
        run_as_root yum install -y "./$FILE"
    elif command -v rpm >/dev/null 2>&1; then
        echo "Installing via rpm..."
        run_as_root rpm -Uvh --replacepkgs "./$FILE"
    else
        echo "No RPM package manager found (dnf/yum/rpm)."
        exit 1
    fi
}

case "$METHOD" in
    tar)
        install_from_tar
        ;;
    apt)
        install_from_apt
        ;;
    rpm)
        install_from_rpm
        ;;
    *)
        echo "Unsupported method: $METHOD"
        usage
        exit 1
        ;;
esac

echo ""
echo "LazyReview $LATEST installed successfully with method '$METHOD'."
echo ""
echo "Run 'lazyreview --help' to get started."
echo ""
echo "To authenticate with GitHub:"
echo "  lazyreview auth login --provider github"
