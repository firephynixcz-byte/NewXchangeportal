import { Html, Body, Head, Heading, Text, Container, Section } from '@react-email/components';
import * as React from 'react';

interface OTPEmailProps {
  otp: string;
}

export default function OTPEmail({ otp }: OTPEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>ยืนยันตัวตน GPO Xchange</Heading>
          <Text style={text}>รหัสยืนยันตัวตนสำหรับเข้าใช้งานระบบของคุณคือ:</Text>
          <Section style={otpBox}>
            <Heading style={otpText}>{otp}</Heading>
          </Section>
          <Text style={footer}>รหัสนี้มีอายุ 5 นาที หากท่านไม่ได้เป็นผู้ขอรหัสนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้ครับ</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#f6f9fc', fontFamily: 'Arial, sans-serif' };
const container = { backgroundColor: '#ffffff', padding: '40px', borderRadius: '8px' };
const h1 = { color: '#0f766e', fontSize: '20px', fontWeight: 'bold' };
const text = { color: '#334155', fontSize: '16px' };
const otpBox = { backgroundColor: '#f0fdfa', padding: '10px', borderRadius: '5px', textAlign: 'center' as const };
const otpText = { color: '#0f766e', fontSize: '32px', margin: '0' };
const footer = { color: '#64748b', fontSize: '12px', marginTop: '30px' };