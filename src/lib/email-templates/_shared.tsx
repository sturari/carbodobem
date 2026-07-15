import * as React from 'react'
import { Section, Text, Hr, Link } from '@react-email/components'

export const BRAND = {
  name: 'Carbo do Bem',
  tagline: 'Comida congelada, feita com carinho.',
  whatsapp: '+55 61 99452-9009',
  whatsappHref: 'https://wa.me/5561994529009',
  instagram: '@carbodobem',
  instagramHref: 'https://instagram.com/carbodobem',
  endereco: 'SHIN CA 5, Ed. Solarium Center, D-1, Loja 87 — Lago Norte, Brasília/DF',
}

export const BrandFooter = () => (
  <Section style={footer}>
    <Hr style={hr} />
    <Text style={footerText}>
      Dúvidas?{' '}
      <Link href={BRAND.whatsappHref} style={link}>
        WhatsApp {BRAND.whatsapp}
      </Link>
      {' • '}
      <Link href={BRAND.instagramHref} style={link}>
        Instagram {BRAND.instagram}
      </Link>
    </Text>
    <Text style={footerAddr}>{BRAND.endereco}</Text>
    <Text style={footerText}>Obrigado por escolher a Carbo do Bem! 💚</Text>
  </Section>
)

const footer = { textAlign: 'center' as const, padding: '16px 0 0 0' }
const hr = { borderColor: '#e5e0d1', margin: '16px 0 12px 0' }
const footerText = { color: '#6b7565', fontSize: '12px', lineHeight: '18px', margin: '4px 0' }
const footerAddr = { color: '#6b7565', fontSize: '11px', lineHeight: '16px', margin: '4px 0' }
const link = { color: '#1f5d3a', textDecoration: 'none' }
