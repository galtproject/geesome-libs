const openpgp = require('openpgp');
const forge = require('node-forge');
const BN = require('bn.js');
const _ = require('lodash');

const pgpHelper = {
  async encrypt(privateKeys, publicKeys, text) {
    const encryptOptions = {
      message: openpgp.message.fromText(text),       // input as Message object
      publicKeys: publicKeys, // for encryption
      privateKeys: privateKeys                                 // for signing (optional)
    };
    // console.log('encryptOptions', encryptOptions);
    const { data: encryptedData } = await openpgp.encrypt(encryptOptions);
    return encryptedData;
  },
  
  async decrypt(privateKeys, publicKeys, encryptedText) {
    const decryptOptions = {
      message: await openpgp.message.readArmored(encryptedText),    // parse armored message
      publicKeys: publicKeys,  // for verification (optional)
      privateKeys: privateKeys                                 // for decryption
    };

    const { data: decryptedData } = await openpgp.decrypt(decryptOptions);
    
    return decryptedData;
  },
  
  async transformKey(masrshalIpfsKey, isPublic) {
    const buffer = new forge.util.ByteBuffer(masrshalIpfsKey);
    const asn1 = forge.asn1.fromDer(buffer);

    const packetList = new openpgp.packet.List();

    const userIdPacket = new openpgp.packet.Userid();
    userIdPacket.format({name: 'Phil Zimmermann', email: 'phil@openpgp.org'});

    packetList.push(userIdPacket);

    const algorithm = openpgp.enums.publicKey.rsa_encrypt_sign;

    const signaturePacket = new openpgp.packet.Signature(new Date());
    signaturePacket.signatureType = openpgp.enums.signature.cert_generic;
    signaturePacket.publicKeyAlgorithm = algorithm;

    let pgpSecretKey;

    if (isPublic) {
      const publicKey = forge.pki.publicKeyFromAsn1(asn1);
      ['n', 'e'].forEach(field => {
        publicKey[field] = new BN(publicKey[field].toString(10));
      });

      const algo = openpgp.enums.write(openpgp.enums.publicKey, openpgp.enums.publicKey.rsa_encrypt_sign);
      const types = [].concat(openpgp.crypto.getPubKeyParamTypes(algo));//, openpgp.crypto.getPrivKeyParamTypes(algo)
      const params = openpgp.crypto.constructParams(
        types, [publicKey.n, publicKey.e, publicKey.d, publicKey.p, publicKey.q, publicKey.u]
      );
      const pgpPublicKey = new openpgp.packet.PublicKey();
      pgpPublicKey.params = params;
      pgpPublicKey.algorithm = algorithm;
      packetList.push(pgpPublicKey);

      signaturePacket.issuerKeyId = pgpPublicKey.getKeyId();

      signaturePacket.hashAlgorithm = await openpgp.key.getPreferredHashAlgo(null, pgpPublicKey);
    } else {
      const privateKey = forge.pki.privateKeyFromAsn1(asn1);
      ['p', 'q', 'n', 'e', 'd'].forEach(field => {
        privateKey[field] = new BN(privateKey[field].toString(10));
      });
      privateKey.u = privateKey.p.invm(privateKey.q);

      const algo = openpgp.enums.write(openpgp.enums.publicKey, openpgp.enums.publicKey.rsa_encrypt_sign);
      const types = [].concat(openpgp.crypto.getPubKeyParamTypes(algo), openpgp.crypto.getPrivKeyParamTypes(algo));
      const params = openpgp.crypto.constructParams(
        types, [privateKey.n, privateKey.e, privateKey.d, privateKey.p, privateKey.q, privateKey.u]
      );
      pgpSecretKey = new openpgp.packet.SecretKey();
      pgpSecretKey.params = params;
      pgpSecretKey.algorithm = algorithm;
      packetList.push(pgpSecretKey);

      signaturePacket.hashAlgorithm = await openpgp.key.getPreferredHashAlgo(null, pgpSecretKey);
      signaturePacket.keyFlags = [openpgp.enums.keyFlags.certify_keys | openpgp.enums.keyFlags.sign_data];

      pgpSecretKey.isDecrypted = (function () {
        return true;
      }).bind(pgpSecretKey);
    }

    const config = {};

    signaturePacket.preferredSymmetricAlgorithms = createdPreferredAlgos([
      // prefer aes256, aes128, then aes192 (no WebCrypto support: https://www.chromium.org/blink/webcrypto#TOC-AES-support)
      openpgp.enums.symmetric.aes256,
      openpgp.enums.symmetric.aes128,
      openpgp.enums.symmetric.aes192,
      openpgp.enums.symmetric.cast5,
      openpgp.enums.symmetric.tripledes
    ], config.encryption_cipher);
    if (config.aead_protect) {
      signaturePacket.preferredAeadAlgorithms = createdPreferredAlgos([
        openpgp.enums.aead.eax,
        openpgp.enums.aead.ocb
      ], config.aead_mode);
    }
    signaturePacket.preferredHashAlgorithms = createdPreferredAlgos([
      // prefer fast asm.js implementations (SHA-256). SHA-1 will not be secure much longer...move to bottom of list
      openpgp.enums.hash.sha256,
      openpgp.enums.hash.sha512,
      openpgp.enums.hash.sha1
    ], config.prefer_hash_algorithm);
    signaturePacket.preferredCompressionAlgorithms = createdPreferredAlgos([
      openpgp.enums.compression.zlib,
      openpgp.enums.compression.zip
    ], config.compression);
    signaturePacket.isPrimaryUserID = true;
    if (config.integrity_protect) {
      signaturePacket.features = [0];
      signaturePacket.features[0] |= openpgp.enums.features.modification_detection;
    }
    if (config.aead_protect) {
      signaturePacket.features || (signaturePacket.features = [0]);
      signaturePacket.features[0] |= openpgp.enums.features.aead;
    }
    if (config.v5_keys) {
      signaturePacket.features || (signaturePacket.features = [0]);
      signaturePacket.features[0] |= openpgp.enums.features.v5_keys;
    }

    if (pgpSecretKey) {
      const dataToSign = {};
      dataToSign.userId = userIdPacket;
      dataToSign.key = pgpSecretKey;

      await signaturePacket.sign(pgpSecretKey, dataToSign);
    }

    packetList.push(signaturePacket);

    const resultKey = new openpgp.key.Key(packetList);

    resultKey.getSigningKey = (function () {
      return this;
    }).bind(resultKey);

    resultKey.getEncryptionKey = (function () {
      return this;
    }).bind(resultKey);

    resultKey.getPrimaryUser = (async function () {
      const primaryKey = this.keyPacket;
      const dataToVerify = {userId: userIdPacket, key: primaryKey};
      const selfCertification = await getLatestValidSignature(this.users[0].selfCertifications, primaryKey, openpgp.enums.signature.cert_generic, dataToVerify);
      return _.extend(this.users[0], {selfCertification});
    }).bind(resultKey);

    resultKey.getKeys = (function() {
      return [this];
    }).bind(resultKey);

    return resultKey;
  }

};

module.exports = pgpHelper;

function createdPreferredAlgos(algos, configAlgo) {
  if (configAlgo) { // Not `uncompressed` / `plaintext`
    const configIndex = algos.indexOf(configAlgo);
    if (configIndex >= 1) { // If it is included and not in first place,
      algos.splice(configIndex, 1); // remove it.
    }
    if (configIndex !== 0) { // If it was included and not in first place, or wasn't included,
      algos.unshift(configAlgo); // add it to the front.
    }
  }
  return algos;
}

async function getLatestValidSignature(signatures, primaryKey, signatureType, dataToVerify, date = new Date()) {
  // console.log('getLatestValidSignature', signatures);
  return signatures[0];
  // let signature;
  // for (let i = signatures.length - 1; i >= 0; i--) {
  //   if ((!signature || signatures[i].created >= signature.created) &&
  //     // check binding signature is not expired (ie, check for V4 expiration time)
  //     !signatures[i].isExpired(date) && (
  //       // check binding signature is verified
  //       signatures[i].verified || (await signatures[i].verify(primaryKey, signatureType, dataToVerify)))) {
  //     signature = signatures[i];
  //   }
  // }
  // return signature;
}
