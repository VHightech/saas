import {
    Body,
    Button,
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

interface EmailAssociatedProps {
    /** Nome del cliente, se a sistema. Vuoto → formula impersonale. */
    name?: string | null;
    /** URL del portale per il primo accesso. */
    portalUrl: string;
}

/**
 * Notifica al cliente che il suo indirizzo email è stato associato all'utenza.
 * Parte quando un operatore CED inserisce (o corregge) l'email dal pannello admin.
 *
 * Volutamente NON contiene il codice cliente né altri dati dell'utenza: se
 * l'operatore sbagliasse a digitare l'indirizzo, la mail finirebbe a un estraneo.
 * Il codice cliente il cliente lo ha già sulla bolletta.
 */
export default function EmailAssociatedEmail({ name, portalUrl }: EmailAssociatedProps) {
    const greeting = name && name.trim().length > 0 ? `Gentile ${name.trim()},` : 'Gentile cliente,';

    return (
        <Html lang="it" dir="ltr">
            <Head />
            <Preview>Il tuo indirizzo email è stato associato all&apos;utenza</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
                        <Section className="mt-[32px]">
                            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                                Indirizzo email associato
                            </Heading>
                            <Text className="text-black text-[14px] leading-[24px]">
                                {greeting}
                            </Text>
                            <Text className="text-black text-[14px] leading-[24px]">
                                ti confermiamo che <strong>questo indirizzo email è stato associato
                                alla tua utenza</strong> sul portale Acquambiente Marche.
                            </Text>
                        </Section>

                        <Section className="bg-gray-50 rounded-lg p-6 my-6 border border-gray-100">
                            <Text className="text-black text-[14px] leading-[24px] m-0">
                                Da ora puoi completare il <strong>primo accesso</strong> al portale
                                con il tuo Codice Cliente: riceverai il link per impostare la password.
                            </Text>
                        </Section>

                        <Section className="text-center my-[32px]">
                            <Button
                                href={portalUrl}
                                className="bg-[#0080c3] rounded text-white text-[13px] font-semibold no-underline text-center px-5 py-3"
                            >
                                Vai al portale
                            </Button>
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Se non hai richiesto questa associazione, o non riconosci questa utenza,
                            contatta l&apos;ufficio CED rispondendo a questa email: provvederemo a
                            rimuovere l&apos;indirizzo.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
