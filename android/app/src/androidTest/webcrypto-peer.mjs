import { createServer } from 'node:http';
import { webcrypto, randomBytes } from 'node:crypto';

const PORT = Number(process.env.KB_WEBCRYPTO_TEST_PORT || 39771);
const PLAINTEXT = 'Kotha-Barta WebCrypto ECDH interoperability vector';

const server = createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/vector') {
    response.writeHead(404).end();
    return;
  }

  try {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 8192) throw new Error('request too large');
    }

    const recipientJwk = JSON.parse(body);
    const recipientPublicKey = await webcrypto.subtle.importKey(
      'jwk',
      recipientJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
    const senderKeyPair = await webcrypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey', 'deriveBits'],
    );

    // Mirror client/src/utility/crypto.js deriveSharedKey exactly: direct
    // ECDH deriveKey to AES-GCM-256, with no HKDF, salt, info, or AAD.
    const aesKey = await webcrypto.subtle.deriveKey(
      { name: 'ECDH', public: recipientPublicKey },
      senderKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const sharedSecret = await webcrypto.subtle.deriveBits(
      { name: 'ECDH', public: recipientPublicKey },
      senderKeyPair.privateKey,
      256,
    );
    const iv = randomBytes(12);
    const ciphertext = await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      aesKey,
      new TextEncoder().encode(PLAINTEXT),
    );
    const senderPublicKey = await webcrypto.subtle.exportKey('jwk', senderKeyPair.publicKey);

    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({
      senderPublicKey: JSON.stringify(senderPublicKey),
      sharedSecret: Buffer.from(sharedSecret).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      ciphertext: Buffer.from(ciphertext).toString('base64'),
    }));
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain' }).end('synthetic vector generation failed');
  }
});

server.listen(PORT, '127.0.0.1');
