#!/bin/sh
# LazyReview installer script
# Usage: curl -sSL https://raw.githubusercontent.com/tauantcamargo/lazyreview/main/scripts/install.sh | sh

set -e

REPO="tauantcamargo/lazyreview"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"

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

# Get latest version
echo "Fetching latest version..."
LATEST=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST" ]; then
    echo "Could not determine latest version"
    exit 1
fi

VERSION="${LATEST#v}"
echo "Latest version: $LATEST"

# Construct download URL
if [ "$OS" = "windows" ]; then
    FILENAME="lazyreview_${VERSION}_${OS}_${ARCH}.zip"
else
    FILENAME="lazyreview_${VERSION}_${OS}_${ARCH}.tar.gz"
fi

URL="https://github.com/$REPO/releases/download/$LATEST/$FILENAME"

# Download and extract
echo "Downloading $URL..."
TMPDIR=$(mktemp -d)
cd "$TMPDIR"

curl -sLO "$URL"

if [ "$OS" = "windows" ]; then
    unzip -q "$FILENAME"
else
    tar -xzf "$FILENAME"
fi

# Install
echo "Installing to $INSTALL_DIR..."
if [ -w "$INSTALL_DIR" ]; then
    mv lazyreview "$INSTALL_DIR/"
else
    sudo mv lazyreview "$INSTALL_DIR/"
fi

# Cleanup
cd -
rm -rf "$TMPDIR"

echo ""
echo "LazyReview $LATEST installed successfully!"
echo ""
echo "Run 'lazyreview --help' to get started."
echo ""
echo "To authenticate with GitHub:"
echo "  lazyreview auth login --provider github"
