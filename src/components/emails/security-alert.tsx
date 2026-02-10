import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
    Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface SecurityAlertEmailProps {
    name: string;
    email: string;
    username: string;
    clientCode: string;
    timestamp: string;
}

export default function SecurityAlertEmail({
    name,
    email,
    username,
    clientCode,
    timestamp,
}: SecurityAlertEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>Tentativo di registrazione non autorizzato rilevato</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
                        <Section className="mt-[32px]">
                            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                                Segnalazione Sicurezza
                            </Heading>
                            <Text className="text-black text-[14px] leading-[24px]">
                                Il sistema ha bloccato un tentativo di registrazione con un <strong>Codice Cliente non valido</strong>.
                            </Text>
                        </Section>

                        <Section className="bg-gray-50 rounded-lg p-6 my-6 border border-gray-100">
                            <Text className="text-black text-[14px] leading-[24px] font-bold mb-4 mt-0">
                                Dettagli del tentativo:
                            </Text>
                            <div className="space-y-2">
                                <Text className="text-black text-[14px] m-0">
                                    <span className="text-gray-500">Nome:</span> {name}
                                </Text>
                                <Text className="text-black text-[14px] m-0">
                                    <span className="text-gray-500">Email:</span> {email}
                                </Text>
                                <Text className="text-black text-[14px] m-0">
                                    <span className="text-gray-500">Username scartato:</span> {username}
                                </Text>
                                <Text className="text-black text-[14px] m-0">
                                    <span className="text-gray-500">Codice Cliente (NON VALIDO):</span>{' '}
                                    <span className="font-mono bg-red-50 text-red-600 px-1 rounded">{clientCode}</span>
                                </Text>
                                <Text className="text-black text-[14px] m-0">
                                    <span className="text-gray-500">Data/Ora:</span> {timestamp}
                                </Text>
                            </div>
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Seu questo tentativo ti sembra sospetto, verifica i log di sistema o contatta l'amministratore del database.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}


