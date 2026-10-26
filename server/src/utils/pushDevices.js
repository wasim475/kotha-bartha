function parsePushDeviceRegistration(body) {
  const installationId = String(body?.installationId || "");
  const token = String(body?.token || "");
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(installationId) || token.length < 32 || token.length > 4096) {
    return null;
  }
  return { installationId, token };
}

function isValidPushInstallationId(installationId) {
  return /^[A-Za-z0-9_-]{16,128}$/.test(installationId);
}

module.exports = { parsePushDeviceRegistration, isValidPushInstallationId };
