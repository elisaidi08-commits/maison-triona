import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { COULEURS_QR, QrCodeError, qrCodeSvg, TAILLE_QR } from '../../src/lib/auth/qr-code.ts'

// QR code d'enrôlement du TOTP (story 3.2, partie D ; D68) : un SVG valide, produit sur place, sans
// aucun appel réseau. URI factice, au format de Better Auth.

const URI =
  'otpauth://totp/Maison%20Triona:compte-factice%40exemple.test?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Maison%20Triona&digits=6&period=30'

describe('QR code d’enrôlement', () => {
  it('rend un SVG seul : une balise svg, un fond, un tracé, ni script ni lien', async () => {
    const svg = await qrCodeSvg(URI)
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" '))
    assert.ok(svg.endsWith('</svg>'))
    assert.match(svg, new RegExp(`width="${TAILLE_QR}" height="${TAILLE_QR}"`))
    const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/)
    assert.ok(viewBox)
    // Version 1 à 40 : 21 à 177 modules, plus 2 × 4 de zone de silence.
    const taille = Number(viewBox[1])
    assert.equal(taille, Number(viewBox[2]))
    assert.ok(taille >= 29 && taille <= 185 && (taille - 8 - 17) % 4 === 0, String(taille))
    assert.equal(svg.match(/<[a-z]/gi)?.length, 3)
    assert.match(svg, /<path fill="#f3ede1" d="M0 0h\d+v\d+H0z"\/>/)
    assert.match(svg, /<path stroke="#2a241f" d="M[Mmh0-9. ]{50,}"\/>/)
    for (const interdit of [/<script/i, /\son\w+=/i, /href/i, /<foreignObject/i, /style/i]) {
      assert.doesNotMatch(svg, interdit)
    }
    // Le secret n'apparaît jamais en clair dans le SVG (il n'est qu'encodé en modules).
    assert.ok(!svg.includes('JBSWY3DP'))
  })

  it('est déterministe : la même URI donne le même dessin', async () => {
    assert.equal(await qrCodeSvg(URI), await qrCodeSvg(URI))
    assert.notEqual(await qrCodeSvg(URI), await qrCodeSvg(URI.replace('JBSWY3DP', 'KRSXG5CT')))
  })

  it('ne fait aucun appel réseau', async () => {
    const appels: string[] = []
    const fetchOriginal = globalThis.fetch
    const originaux = {
      httpRequest: http.request,
      httpGet: http.get,
      httpsRequest: https.request,
      httpsGet: https.get,
      netConnect: net.connect,
      netCreateConnection: net.createConnection,
    }
    const espion = (nom: string) =>
      (() => {
        appels.push(nom)
        throw new Error('réseau interdit')
      }) as never
    globalThis.fetch = espion('fetch')
    http.request = espion('http.request')
    http.get = espion('http.get')
    https.request = espion('https.request')
    https.get = espion('https.get')
    net.connect = espion('net.connect')
    net.createConnection = espion('net.createConnection')
    try {
      assert.ok((await qrCodeSvg(URI)).length > 500)
    } finally {
      globalThis.fetch = fetchOriginal
      http.request = originaux.httpRequest
      http.get = originaux.httpGet
      https.request = originaux.httpsRequest
      https.get = originaux.httpsGet
      net.connect = originaux.netConnect
      net.createConnection = originaux.netCreateConnection
    }
    assert.deepEqual(appels, [])
  })

  it('refuse autre chose qu’une URI otpauth TOTP, sans la citer', async () => {
    for (const uri of ['', 'https://exemple.test/?secret=ABC', 'otpauth://hotp/x?secret=ABC']) {
      const erreur = await qrCodeSvg(uri).then(
        () => assert.fail('une erreur était attendue'),
        (error: unknown) => error,
      )
      assert.ok(erreur instanceof QrCodeError)
      assert.ok(!String(erreur).includes('secret'))
    }
  })

  it('reprend les couleurs encre et ivoire de tokens.css', () => {
    const tokens = readFileSync(
      fileURLToPath(new URL('../../src/styles/tokens.css', import.meta.url)),
      'utf8',
    )
    assert.match(tokens, new RegExp(`--color-encre: ${COULEURS_QR.fonce};`))
    assert.match(tokens, new RegExp(`--color-ivoire: ${COULEURS_QR.clair};`))
  })
})
