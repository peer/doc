set -e

apt-get update -q -q
apt-get install --yes --force-yes git

cd /source
echo "module.exports = '$(git describe --always --dirty=+)';" > /source/server/imports/gitversion.js
