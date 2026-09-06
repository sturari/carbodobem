import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BrandFooter } from './_shared'

interface Props {
  nome_cliente?: string
  pedido_id?: string
  valor_total?: number
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const Email = ({ nome_cliente, pedido_id, valor_total }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Pedido entregue — obrigado por escolher a Carbo do Bem 💚</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Carbo do Bem</Heading>
          <Text style={tagline}>Comida congelada, feita com carinho.</Text>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Pedido entregue ✅</Heading>
          <Text style={paragraph}>
            {nome_cliente ? `Olá, ${nome_cliente}! ` : 'Olá! '}
            Seu pedido foi entregue. Esperamos que você aproveite cada garfada.
          </Text>
          {pedido_id && (
            <Text style={pedidoRef}>
              <strong>Pedido:</strong> #{pedido_id.slice(0, 8).toUpperCase()}
            </Text>
          )}
          {typeof valor_total === 'number' && valor_total > 0 && (
            <Text style={pedidoRef}><strong>Total:</strong> {brl(valor_total)}</Text>
          )}
        </Section>

        <Section style={card}>
          <Heading as="h3" style={h3}>Conte pra gente!</Heading>
          <Text style={paragraph}>
            Se gostou, adoraríamos ver uma foto marcando @carbodobem no Instagram — e se algo não saiu como esperado, é só responder este email.
          </Text>
        </Section>

        <BrandFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data.pedido_id
      ? `Pedido #${String(data.pedido_id).slice(0, 8).toUpperCase()} entregue — Carbo do Bem`
      : 'Pedido entregue — Carbo do Bem',
  displayName: 'Pedido entregue',
  previewData: {
    nome_cliente: 'Maria',
    pedido_id: 'a1b2c3d4-0000-0000-0000-000000000000',
    valor_total: 125.8,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 20px' }
const header = { textAlign: 'center' as const, paddingBottom: '8px' }
const brand = { color: '#0b4a3d', fontSize: '28px', margin: '0', fontWeight: 700 }
const tagline = { color: '#5a6b64', fontSize: '13px', margin: '4px 0 0 0' }
const card = { backgroundColor: '#f2f7f5', borderRadius: '14px', padding: '20px 22px', margin: '16px 0' }
const h2 = { color: '#0b4a3d', fontSize: '20px', margin: '0 0 8px 0' }
const h3 = { color: '#0b4a3d', fontSize: '16px', margin: '0 0 10px 0' }
const paragraph = { color: '#1a1a1a', fontSize: '14px', lineHeight: '22px', margin: '0 0 6px 0' }
const pedidoRef = { color: '#1a1a1a', fontSize: '13px', margin: '8px 0 0 0' }
