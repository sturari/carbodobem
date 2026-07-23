import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BrandFooter } from './_shared'


interface Item {
  nome: string
  quantidade: number
  preco_unitario: number
}

interface Props {
  nome_cliente?: string
  pedido_id?: string
  itens?: Item[]
  subtotal?: number
  taxa_entrega?: number
  valor_total?: number
  horario_entrega?: string
  endereco?: {
    rua: string
    numero: string
    complemento?: string | null
    bairro: string
    cidade: string
    uf: string
    cep: string
  }
  observacoes?: string | null
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatEntrega = (iso?: string) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const Email = ({
  nome_cliente,
  pedido_id,
  itens = [],
  subtotal = 0,
  taxa_entrega = 0,
  valor_total = 0,
  horario_entrega,
  endereco,
  observacoes,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Recebemos seu pedido na Carbo do Bem — obrigado!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>Carbo do Bem</Heading>
          <Text style={tagline}>Comida congelada, feita com carinho.</Text>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>
            Pedido confirmado ✓
          </Heading>
          <Text style={paragraph}>
            {nome_cliente ? `Olá, ${nome_cliente}! ` : 'Olá! '}
            Recebemos o seu pedido e já estamos preparando tudo com muito capricho.
          </Text>
          {pedido_id && (
            <Text style={pedidoRef}>
              <strong>Pedido:</strong> #{pedido_id.slice(0, 8).toUpperCase()}
            </Text>
          )}
        </Section>

        <Section style={card}>
          <Heading as="h3" style={h3}>Itens do pedido</Heading>
          {itens.map((it, i) => (
            <Row key={i} style={itemRow}>
              <Column style={itemQty}>{it.quantidade}×</Column>
              <Column style={itemName}>{it.nome}</Column>
              <Column style={itemPrice}>
                {brl(it.quantidade * it.preco_unitario)}
              </Column>
            </Row>
          ))}
          <Hr style={hr} />
          <Row style={totalRow}>
            <Column style={totalLabel}>Subtotal</Column>
            <Column style={totalValue}>{brl(subtotal)}</Column>
          </Row>
          <Row style={totalRow}>
            <Column style={totalLabel}>Taxa de entrega</Column>
            <Column style={totalValue}>{brl(taxa_entrega)}</Column>
          </Row>
          <Hr style={hr} />
          <Row style={totalRow}>
            <Column style={totalLabelBold}>Total</Column>
            <Column style={totalValueBold}>{brl(valor_total)}</Column>
          </Row>
        </Section>

        {horario_entrega && (
          <Section style={card}>
            <Heading as="h3" style={h3}>Horário de entrega</Heading>
            <Text style={paragraph}>{formatEntrega(horario_entrega)}</Text>
          </Section>
        )}

        {endereco && (
          <Section style={card}>
            <Heading as="h3" style={h3}>Endereço de entrega</Heading>
            <Text style={paragraph}>
              {endereco.rua}, {endereco.numero}
              {endereco.complemento ? ` — ${endereco.complemento}` : ''}
              <br />
              {endereco.bairro} — {endereco.cidade}/{endereco.uf}
              <br />
              CEP {endereco.cep}
            </Text>
          </Section>
        )}

        {observacoes && (
          <Section style={card}>
            <Heading as="h3" style={h3}>Observações</Heading>
            <Text style={paragraph}>{observacoes}</Text>
          </Section>
        )}

        <BrandFooter />

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data.pedido_id
      ? `Pedido confirmado #${String(data.pedido_id).slice(0, 8).toUpperCase()} — Carbo do Bem`
      : 'Pedido confirmado — Carbo do Bem',
  displayName: 'Confirmação de pedido',
  previewData: {
    nome_cliente: 'Maria',
    pedido_id: 'a1b2c3d4-0000-0000-0000-000000000000',
    itens: [
      { nome: 'Escondidinho de carne 500g', quantidade: 2, preco_unitario: 32.9 },
      { nome: 'Lasanha à bolonhesa 700g', quantidade: 1, preco_unitario: 48.0 },
    ],
    subtotal: 113.8,
    taxa_entrega: 12,
    valor_total: 125.8,
    horario_entrega: new Date(Date.now() + 86400000).toISOString(),
    endereco: {
      rua: 'Rua das Palmeiras',
      numero: '123',
      complemento: 'Apto 42',
      bairro: 'Jardim Botânico',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
      cep: '22470050',
    },
    observacoes: 'Deixar com o porteiro se eu não estiver.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 20px' }
const header = { textAlign: 'center' as const, paddingBottom: '8px' }
const brand = { color: '#1f5d3a', fontSize: '28px', margin: '0', fontWeight: 700 }
const tagline = { color: '#6b7565', fontSize: '13px', margin: '4px 0 0 0' }
const card = { backgroundColor: '#f7f5ef', borderRadius: '14px', padding: '20px 22px', margin: '16px 0' }
const h2 = { color: '#1f5d3a', fontSize: '20px', margin: '0 0 8px 0' }
const h3 = { color: '#1f5d3a', fontSize: '16px', margin: '0 0 10px 0' }
const paragraph = { color: '#2c3a2e', fontSize: '14px', lineHeight: '22px', margin: '0 0 6px 0' }
const pedidoRef = { color: '#2c3a2e', fontSize: '13px', margin: '8px 0 0 0' }
const itemRow = { padding: '6px 0' }
const itemQty = { width: '40px', color: '#1f5d3a', fontWeight: 600, fontSize: '14px', verticalAlign: 'top' as const }
const itemName = { color: '#2c3a2e', fontSize: '14px', verticalAlign: 'top' as const }
const itemPrice = { width: '90px', textAlign: 'right' as const, color: '#2c3a2e', fontSize: '14px', verticalAlign: 'top' as const }
const hr = { borderColor: '#e5e0d1', margin: '12px 0' }
const totalRow = { padding: '4px 0' }
const totalLabel = { color: '#6b7565', fontSize: '14px' }
const totalValue = { textAlign: 'right' as const, color: '#2c3a2e', fontSize: '14px' }
const totalLabelBold = { color: '#1f5d3a', fontSize: '16px', fontWeight: 700 }
const totalValueBold = { textAlign: 'right' as const, color: '#c45a1a', fontSize: '18px', fontWeight: 700 }
const footer = { textAlign: 'center' as const, padding: '16px 0 0 0' }
const footerText = { color: '#6b7565', fontSize: '12px', lineHeight: '18px', margin: 0 }
