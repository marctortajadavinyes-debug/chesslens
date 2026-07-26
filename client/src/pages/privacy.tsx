/**
 * privacy.tsx
 *
 * Public privacy policy page — /privacy
 * Available in Catalan, Spanish and English.
 * Reads the app language from localStorage (same key as the rest of FotoChess).
 * No login required. No Drive dependency. Works on direct URL reload.
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";

type Lang = "ca" | "es" | "en";

const SETTINGS_KEY = "chesslens_user_settings_v1";

function readStoredLang(): Lang {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "ca";
    const parsed = JSON.parse(raw) as { appLanguage?: string };
    const l = parsed?.appLanguage;
    if (l === "ca" || l === "es" || l === "en") return l;
  } catch {
    // ignore
  }
  return "ca";
}

// ─── Policy content ───────────────────────────────────────────────────────────

interface PolicyContent {
  title: string;
  lastUpdated: string;
  backLink: string;
  intro: string;
  sections: { heading: string; body: React.ReactNode }[];
}

const CONTACT_EMAIL = "chessproapp.mvp@gmail.com";

function EmailLink() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="underline hover:text-foreground transition-colors"
    >
      {CONTACT_EMAIL}
    </a>
  );
}

const CONTENT: Record<Lang, PolicyContent> = {
  ca: {
    title: "Política de privacitat de FotoChess",
    lastUpdated: "Última actualització: 26 de juliol de 2026",
    backLink: "Tornar a FotoChess",
    intro:
      "FotoChess respecta la privacitat dels usuaris i tracta únicament les dades necessàries per prestar les funcionalitats sol·licitades.",
    sections: [
      {
        heading: "1. Responsable del tractament",
        body: (
          <>
            <p>El responsable del tractament és:</p>
            <ul>
              <li>
                <strong>Responsable:</strong> Marc Tortajada Vinyes, creador i
                responsable de FotoChess
              </li>
              <li>
                <strong>País:</strong> Espanya
              </li>
              <li>
                <strong>Correu de contacte:</strong> <EmailLink />
              </li>
            </ul>
            <p>
              Aquest correu es pot utilitzar per fer consultes sobre privacitat
              o per exercir els drets reconeguts per la normativa de protecció
              de dades.
            </p>
          </>
        ),
      },
      {
        heading: "2. Quines dades tracta FotoChess",
        body: (
          <>
            <p>
              Segons les funcions que utilitzi l'usuari, FotoChess pot tractar
              les categories de dades següents:
            </p>
            <ul>
              <li>
                les imatges de les planelles d'escacs seleccionades o
                fotografiades per l'usuari;
              </li>
              <li>
                la informació escrita a la planella, com ara els noms dels
                jugadors, el torneig, la data, el resultat i les jugades;
              </li>
              <li>
                el PGN generat, les jugades, les correccions i les posicions de
                la partida;
              </li>
              <li>
                un identificador tècnic aleatori del dispositiu, utilitzat per
                separar les partides temporals de diferents usuaris;
              </li>
              <li>
                les preferències de configuració, com ara els idiomes i el
                format de planella;
              </li>
              <li>
                el nom del jugador i el correu electrònic opcional introduïts a
                Configuració;
              </li>
              <li>
                les dades necessàries per connectar voluntàriament FotoChess
                amb Google Drive;
              </li>
              <li>
                les comunicacions que l'usuari enviï voluntàriament mitjançant
                l'opció de suggeriments;
              </li>
              <li>
                les dades tècniques imprescindibles per al funcionament, la
                seguretat i el diagnòstic d'errors del servei.
              </li>
            </ul>
            <p>
              FotoChess no sol·licita categories especials de dades personals i
              recomana no incloure a les planelles informació que no sigui
              necessària per digitalitzar la partida.
            </p>
          </>
        ),
      },
      {
        heading: "3. Com es tracta la imatge de la planella",
        body: (
          <>
            <p>
              La imatge es pren o se selecciona des del dispositiu de l'usuari
              i es transmet temporalment per prestar el servei de digitalització
              sol·licitat.
            </p>
            <p>Durant el processament:</p>
            <ul>
              <li>
                la imatge pot romandre temporalment en la memòria operativa del
                servei;
              </li>
              <li>
                pot ser tractada pels proveïdors tecnològics estrictament
                necessaris per generar el resultat;
              </li>
              <li>
                el fitxer temporal utilitzat durant el processament s'elimina
                una vegada finalitzada aquesta operació;
              </li>
              <li>no s'incorpora a una base de dades permanent de FotoChess.</li>
            </ul>
            <p>
              FotoChess no publica la imatge, no la comparteix amb altres
              usuaris i no la incorpora a cap biblioteca pròpia, compartida o
              accessible per altres usuaris.
            </p>
            <p>
              FotoChess tampoc utilitza les imatges o les partides per a
              publicitat, no les ven i no crea ni comparteix voluntàriament
              conjunts de dades destinats a entrenar sistemes.
            </p>
            <p>
              Els proveïdors tecnològics necessaris poden efectuar retencions
              tècniques temporals d'acord amb les seves pròpies condicions,
              obligacions de seguretat i configuració del servei. FotoChess no
              activa sistemes addicionals d'emmagatzematge permanent de les
              planelles.
            </p>
          </>
        ),
      },
      {
        heading: "4. Partides temporals",
        body: (
          <>
            <p>
              Mentre l'usuari treballa amb una partida, FotoChess manté
              temporalment a la memòria operativa del servidor:
            </p>
            <ul>
              <li>la imatge necessària per mostrar la planella;</li>
              <li>el PGN provisional o final;</li>
              <li>les jugades detectades;</li>
              <li>les correccions realitzades;</li>
              <li>els errors o punts pendents de revisió;</li>
              <li>les metadades de la partida.</li>
            </ul>
            <p>Aquestes partides temporals:</p>
            <ul>
              <li>estan separades mitjançant un identificador aleatori de dispositiu;</li>
              <li>no són visibles per altres usuaris;</li>
              <li>no s'emmagatzemen en una base de dades permanent;</li>
              <li>
                desapareixen quan el servidor es reinicia o es torna a desplegar;
              </li>
              <li>no constitueixen una biblioteca permanent de FotoChess.</li>
            </ul>
            <p>
              Tancar el navegador no elimina immediatament aquesta informació de
              la memòria operativa, però tampoc la converteix en un arxiu
              permanent.
            </p>
          </>
        ),
      },
      {
        heading: "5. Finalitats del tractament",
        body: (
          <>
            <p>FotoChess tracta les dades exclusivament per:</p>
            <ul>
              <li>digitalitzar una planella d'escacs;</li>
              <li>generar i permetre corregir el PGN;</li>
              <li>mostrar la partida, les jugades i les posicions;</li>
              <li>permetre l'anàlisi voluntària de la partida;</li>
              <li>permetre copiar, descarregar o exportar el PGN;</li>
              <li>
                guardar i consultar partides al Google Drive de l'usuari, quan
                aquest ho sol·licita;
              </li>
              <li>conservar les preferències locals de configuració;</li>
              <li>respondre suggeriments o consultes;</li>
              <li>
                garantir la seguretat, l'estabilitat i el correcte funcionament
                del servei.
              </li>
            </ul>
            <p>
              Les dades no s'utilitzen per elaborar perfils comercials, mostrar
              publicitat personalitzada ni prendre decisions automatitzades que
              produeixin efectes jurídics sobre l'usuari.
            </p>
          </>
        ),
      },
      {
        heading: "6. Base jurídica",
        body: (
          <>
            <p>
              La base jurídica principal és la prestació del servei i l'execució
              de les funcionalitats sol·licitades voluntàriament per l'usuari.
            </p>
            <p>
              Quan l'usuari activa una funció opcional, com ara Google Drive o
              l'enviament d'un suggeriment, el tractament es basa també en
              l'acció i l'autorització expressa de l'usuari.
            </p>
            <p>
              El tractament estrictament necessari per mantenir la seguretat,
              evitar abusos i diagnosticar errors es basa en l'interès legítim
              de mantenir el servei segur i operatiu.
            </p>
          </>
        ),
      },
      {
        heading: "7. Google Drive",
        body: (
          <>
            <p>La connexió amb Google Drive és completament opcional.</p>
            <p>
              FotoChess només sol·licita autorització quan l'usuari decideix
              guardar o consultar les seves partides.
            </p>
            <p>Quan l'usuari activa aquesta funció:</p>
            <ul>
              <li>
                el PGN es desa directament al compte de Google Drive del mateix
                usuari;
              </li>
              <li>
                la imatge original només es desa si l'usuari marca expressament
                aquesta opció;
              </li>
              <li>l'opció de guardar la imatge està desactivada per defecte;</li>
              <li>
                els fitxers es desen al compte de Google Drive del mateix
                usuari, dins la carpeta «Chess Games»;
              </li>
              <li>
                FotoChess accedeix únicament als fitxers creats o gestionats
                mitjançant l'aplicació;
              </li>
              <li>
                FotoChess no obté accés general a la resta dels fitxers del
                Google Drive;
              </li>
              <li>
                el token d'accés roman temporalment al navegador i no
                s'emmagatzema al servidor de FotoChess;
              </li>
              <li>
                FotoChess no conserva una còpia addicional dels fitxers pel fet
                de guardar-los a Drive.
              </li>
            </ul>
            <p>
              Els fitxers guardats a Google Drive romanen sota el control de
              l'usuari fins que aquest decideix eliminar-los.
            </p>
            <p>
              L'usuari pot revocar l'accés de FotoChess des de la configuració
              de seguretat del seu compte de Google.
            </p>
            <p>
              FotoChess utilitza les dades obtingudes de les API de Google
              exclusivament per prestar les funcions de Google Drive
              sol·licitades per l'usuari. Aquestes dades no s'utilitzen per a
              publicitat, elaboració de perfils comercials ni finalitats alienes
              al servei.
            </p>
          </>
        ),
      },
      {
        heading: "8. Anàlisi de les partides",
        body: (
          <>
            <p>
              Quan l'usuari activa l'anàlisi, FotoChess envia al seu propi
              servidor únicament les posicions d'escacs necessàries per
              efectuar el càlcul.
            </p>
            <p>En aquest procés:</p>
            <ul>
              <li>no s'envia la imatge de la planella;</li>
              <li>
                no s'envien els noms dels jugadors ni altres metadades personals;
              </li>
              <li>les posicions no s'envien a un servei extern d'anàlisi;</li>
              <li>
                el resultat es retorna al navegador per mostrar-lo a l'usuari.
              </li>
            </ul>
          </>
        ),
      },
      {
        heading: "9. Dades emmagatzemades al dispositiu",
        body: (
          <>
            <p>
              FotoChess utilitza l'emmagatzematge local del navegador per
              conservar:
            </p>
            <ul>
              <li>el nom del jugador;</li>
              <li>el correu electrònic opcional;</li>
              <li>els idiomes seleccionats;</li>
              <li>el format de planella;</li>
              <li>l'identificador aleatori del dispositiu;</li>
              <li>algunes preferències de la interfície;</li>
              <li>l'identificador de la carpeta de Google Drive.</li>
            </ul>
            <p>
              Aquestes dades romanen al dispositiu fins que l'usuari modifica la
              configuració o elimina les dades del lloc des del navegador.
            </p>
            <p>
              El correu electrònic introduït a Configuració no s'envia
              automàticament al servidor ni s'utilitza per crear un compte.
            </p>
          </>
        ),
      },
      {
        heading: "10. Suggeriments i comunicacions",
        body: (
          <>
            <p>L'opció «Enviar suggeriment» obre el programa de correu de l'usuari.</p>
            <p>
              FotoChess no envia automàticament el missatge ni en conserva una
              còpia al servidor de l'aplicació.
            </p>
            <p>
              Si l'usuari decideix enviar-lo, el missatge serà rebut al correu
              de contacte de FotoChess i es conservarà durant el temps necessari
              per respondre'l, gestionar la incidència i atendre possibles
              responsabilitats.
            </p>
          </>
        ),
      },
      {
        heading: "11. Cookies, analítica i publicitat",
        body: (
          <>
            <p>FotoChess:</p>
            <ul>
              <li>
                no utilitza Google Analytics ni altres sistemes d'analítica de
                comportament;
              </li>
              <li>no realitza seguiment publicitari;</li>
              <li>no crea perfils comercials;</li>
              <li>no ven dades;</li>
              <li>
                no utilitza cookies de sessió per identificar personalment els
                usuaris.
              </li>
            </ul>
            <p>
              Pot utilitzar-se una cookie tècnica o emmagatzematge equivalent
              exclusivament per recordar l'estat d'algun element de la
              interfície. Aquesta informació no s'utilitza per rastrejar
              l'usuari.
            </p>
            <p>
              El proveïdor d'allotjament pot generar registres tècnics, com ara
              adreces IP, tipus de navegador o informació d'errors, d'acord amb
              les seves pròpies polítiques de seguretat i conservació.
            </p>
          </>
        ),
      },
      {
        heading: "12. Destinataris i proveïdors",
        body: (
          <>
            <p>Les dades només poden ser tractades per:</p>
            <ul>
              <li>
                el proveïdor d'allotjament i infraestructura de FotoChess;
              </li>
              <li>
                els proveïdors tecnològics necessaris per processar
                temporalment la planella;
              </li>
              <li>Google, quan l'usuari utilitzi Google Drive;</li>
              <li>
                el proveïdor de correu electrònic, quan l'usuari enviï
                voluntàriament un suggeriment.
              </li>
            </ul>
            <p>
              FotoChess no cedeix dades a tercers per a finalitats comercials,
              publicitàries o de venda d'informació.
            </p>
            <p>
              Alguns proveïdors poden processar informació fora de l'Espai
              Econòmic Europeu. En aquests casos, el tractament es realitzarà
              d'acord amb els mecanismes i garanties exigits per la normativa
              aplicable.
            </p>
          </>
        ),
      },
      {
        heading: "13. Conservació",
        body: (
          <>
            <p>Els criteris de conservació són:</p>
            <ul>
              <li>
                imatges i partides temporals: mentre romanguin necessàries a la
                memòria operativa del servei; desapareixen quan el servidor es
                reinicia o es torna a desplegar;
              </li>
              <li>
                fitxers temporals de processament: s'eliminen després de
                completar el processament;
              </li>
              <li>
                configuració local: fins que l'usuari l'esborra del navegador;
              </li>
              <li>
                Google Drive: fins que l'usuari elimina els fitxers del seu
                compte;
              </li>
              <li>
                tokens de Google: durant la seva vigència temporal al navegador;
              </li>
              <li>
                suggeriments: durant el temps necessari per respondre i
                gestionar la comunicació;
              </li>
              <li>
                registres tècnics: segons els terminis del proveïdor
                d'allotjament i les necessitats de seguretat.
              </li>
            </ul>
            <p>
              Les dades es conservaran únicament durant el temps necessari per
              complir la finalitat que en justifica el tractament.
            </p>
          </>
        ),
      },
      {
        heading: "14. Seguretat",
        body: (
          <>
            <p>
              FotoChess aplica mesures destinades a limitar l'accés no
              autoritzat i protegir les dades durant la transmissió i el
              tractament.
            </p>
            <p>Entre altres mesures:</p>
            <ul>
              <li>
                separa les partides temporals mitjançant identificadors aleatoris
                de dispositiu;
              </li>
              <li>evita mostrar les partides d'un dispositiu a un altre;</li>
              <li>no emmagatzema permanentment els tokens de Google;</li>
              <li>
                limita l'accés de Google Drive als fitxers gestionats per
                l'aplicació;
              </li>
              <li>
                evita registrar el contingut complet de les imatges en els
                missatges tècnics de l'aplicació.
              </li>
            </ul>
            <p>
              Cap servei d'Internet pot garantir una seguretat absoluta, però
              FotoChess adopta mesures proporcionades a les característiques del
              servei.
            </p>
          </>
        ),
      },
      {
        heading: "15. Drets de l'usuari",
        body: (
          <>
            <p>L'usuari pot exercir els drets de:</p>
            <ul>
              <li>accés;</li>
              <li>rectificació;</li>
              <li>supressió;</li>
              <li>limitació del tractament;</li>
              <li>oposició;</li>
              <li>portabilitat, quan sigui aplicable;</li>
              <li>
                retirada del consentiment, sense afectar la licitud del
                tractament anterior.
              </li>
            </ul>
            <p>Per exercir aquests drets, pot escriure a:</p>
            <p>
              <EmailLink />
            </p>
            <p>
              També pot presentar una reclamació davant l'Agència Espanyola de
              Protecció de Dades.
            </p>
          </>
        ),
      },
      {
        heading: "16. Modificacions de la política",
        body: (
          <>
            <p>
              FotoChess pot actualitzar aquesta Política de privacitat quan
              canviïn les seves funcionalitats, els proveïdors utilitzats o les
              obligacions legals aplicables.
            </p>
            <p>
              La versió vigent indicarà sempre la data de l'última
              actualització.
            </p>
            <p>
              Si un canvi afecta substancialment la manera com es tracten les
              dades, s'informarà els usuaris de manera visible abans
              d'aplicar-lo.
            </p>
          </>
        ),
      },
    ],
  },

  es: {
    title: "Política de privacidad de FotoChess",
    lastUpdated: "Última actualización: 26 de julio de 2026",
    backLink: "Volver a FotoChess",
    intro:
      "FotoChess respeta la privacidad de los usuarios y trata únicamente los datos necesarios para prestar las funcionalidades solicitadas.",
    sections: [
      {
        heading: "1. Responsable del tratamiento",
        body: (
          <>
            <p>El responsable del tratamiento es:</p>
            <ul>
              <li>
                <strong>Responsable:</strong> Marc Tortajada Vinyes, creador y
                responsable de FotoChess
              </li>
              <li>
                <strong>País:</strong> España
              </li>
              <li>
                <strong>Correo de contacto:</strong> <EmailLink />
              </li>
            </ul>
            <p>
              Este correo puede utilizarse para realizar consultas sobre
              privacidad o para ejercer los derechos reconocidos por la
              normativa de protección de datos.
            </p>
          </>
        ),
      },
      {
        heading: "2. Qué datos trata FotoChess",
        body: (
          <>
            <p>
              Según las funciones que utilice el usuario, FotoChess puede tratar
              las siguientes categorías de datos:
            </p>
            <ul>
              <li>
                las imágenes de las planillas de ajedrez seleccionadas o
                fotografiadas por el usuario;
              </li>
              <li>
                la información escrita en la planilla, como los nombres de los
                jugadores, el torneo, la fecha, el resultado y las jugadas;
              </li>
              <li>
                el PGN generado, las jugadas, las correcciones y las posiciones
                de la partida;
              </li>
              <li>
                un identificador técnico aleatorio del dispositivo, utilizado
                para separar las partidas temporales de distintos usuarios;
              </li>
              <li>
                las preferencias de configuración, como los idiomas y el formato
                de planilla;
              </li>
              <li>
                el nombre del jugador y el correo electrónico opcional
                introducidos en Configuración;
              </li>
              <li>
                los datos necesarios para conectar voluntariamente FotoChess con
                Google Drive;
              </li>
              <li>
                las comunicaciones que el usuario envíe voluntariamente mediante
                la opción de sugerencias;
              </li>
              <li>
                los datos técnicos imprescindibles para el funcionamiento, la
                seguridad y el diagnóstico de errores del servicio.
              </li>
            </ul>
            <p>
              FotoChess no solicita categorías especiales de datos personales y
              recomienda no incluir en las planillas información que no sea
              necesaria para digitalizar la partida.
            </p>
          </>
        ),
      },
      {
        heading: "3. Cómo se trata la imagen de la planilla",
        body: (
          <>
            <p>
              La imagen se toma o selecciona desde el dispositivo del usuario y
              se transmite temporalmente para prestar el servicio de
              digitalización solicitado.
            </p>
            <p>Durante el procesamiento:</p>
            <ul>
              <li>
                la imagen puede permanecer temporalmente en la memoria operativa
                del servicio;
              </li>
              <li>
                puede ser tratada por los proveedores tecnológicos estrictamente
                necesarios para generar el resultado;
              </li>
              <li>
                el archivo temporal utilizado durante el procesamiento se elimina
                una vez finalizada esta operación;
              </li>
              <li>
                no se incorpora a una base de datos permanente de FotoChess.
              </li>
            </ul>
            <p>
              FotoChess no publica la imagen, no la comparte con otros usuarios
              ni la incorpora a ninguna biblioteca propia, compartida o
              accesible para otros usuarios.
            </p>
            <p>
              FotoChess tampoco utiliza las imágenes o las partidas para
              publicidad, no las vende y no crea ni comparte voluntariamente
              conjuntos de datos destinados a entrenar sistemas.
            </p>
            <p>
              Los proveedores tecnológicos necesarios pueden efectuar retenciones
              técnicas temporales de acuerdo con sus propias condiciones,
              obligaciones de seguridad y configuración del servicio. FotoChess
              no activa sistemas adicionales de almacenamiento permanente de las
              planillas.
            </p>
          </>
        ),
      },
      {
        heading: "4. Partidas temporales",
        body: (
          <>
            <p>
              Mientras el usuario trabaja con una partida, FotoChess mantiene
              temporalmente en la memoria operativa del servidor:
            </p>
            <ul>
              <li>la imagen necesaria para mostrar la planilla;</li>
              <li>el PGN provisional o final;</li>
              <li>las jugadas detectadas;</li>
              <li>las correcciones realizadas;</li>
              <li>los errores o puntos pendientes de revisión;</li>
              <li>los metadatos de la partida.</li>
            </ul>
            <p>Estas partidas temporales:</p>
            <ul>
              <li>
                están separadas mediante un identificador aleatorio de
                dispositivo;
              </li>
              <li>no son visibles para otros usuarios;</li>
              <li>no se almacenan en una base de datos permanente;</li>
              <li>
                desaparecen cuando el servidor se reinicia o se vuelve a
                desplegar;
              </li>
              <li>no constituyen una biblioteca permanente de FotoChess.</li>
            </ul>
            <p>
              Cerrar el navegador no elimina inmediatamente esta información de
              la memoria operativa, pero tampoco la convierte en un archivo
              permanente.
            </p>
          </>
        ),
      },
      {
        heading: "5. Finalidades del tratamiento",
        body: (
          <>
            <p>FotoChess trata los datos exclusivamente para:</p>
            <ul>
              <li>digitalizar una planilla de ajedrez;</li>
              <li>generar y permitir corregir el PGN;</li>
              <li>mostrar la partida, las jugadas y las posiciones;</li>
              <li>permitir el análisis voluntario de la partida;</li>
              <li>permitir copiar, descargar o exportar el PGN;</li>
              <li>
                guardar y consultar partidas en el Google Drive del usuario,
                cuando este lo solicita;
              </li>
              <li>conservar las preferencias locales de configuración;</li>
              <li>responder sugerencias o consultas;</li>
              <li>
                garantizar la seguridad, la estabilidad y el correcto
                funcionamiento del servicio.
              </li>
            </ul>
            <p>
              Los datos no se utilizan para elaborar perfiles comerciales,
              mostrar publicidad personalizada ni tomar decisiones automatizadas
              que produzcan efectos jurídicos sobre el usuario.
            </p>
          </>
        ),
      },
      {
        heading: "6. Base jurídica",
        body: (
          <>
            <p>
              La base jurídica principal es la prestación del servicio y la
              ejecución de las funcionalidades solicitadas voluntariamente por el
              usuario.
            </p>
            <p>
              Cuando el usuario activa una función opcional, como Google Drive o
              el envío de una sugerencia, el tratamiento se basa también en la
              acción y autorización expresa del usuario.
            </p>
            <p>
              El tratamiento estrictamente necesario para mantener la seguridad,
              evitar abusos y diagnosticar errores se basa en el interés legítimo
              de mantener el servicio seguro y operativo.
            </p>
          </>
        ),
      },
      {
        heading: "7. Google Drive",
        body: (
          <>
            <p>La conexión con Google Drive es completamente opcional.</p>
            <p>
              FotoChess solo solicita autorización cuando el usuario decide
              guardar o consultar sus partidas.
            </p>
            <p>Cuando el usuario activa esta función:</p>
            <ul>
              <li>
                el PGN se guarda directamente en la cuenta de Google Drive del
                propio usuario;
              </li>
              <li>
                la imagen original solo se guarda si el usuario marca
                expresamente esta opción;
              </li>
              <li>
                la opción de guardar la imagen está desactivada por defecto;
              </li>
              <li>
                los archivos se guardan en la cuenta de Google Drive del propio
                usuario, dentro de la carpeta «Chess Games»;
              </li>
              <li>
                FotoChess accede únicamente a los archivos creados o gestionados
                mediante la aplicación;
              </li>
              <li>
                FotoChess no obtiene acceso general al resto de los archivos de
                Google Drive;
              </li>
              <li>
                el token de acceso permanece temporalmente en el navegador y no
                se almacena en el servidor de FotoChess;
              </li>
              <li>
                FotoChess no conserva una copia adicional de los archivos por el
                hecho de guardarlos en Drive.
              </li>
            </ul>
            <p>
              Los archivos guardados en Google Drive permanecen bajo el control
              del usuario hasta que este decide eliminarlos.
            </p>
            <p>
              El usuario puede revocar el acceso de FotoChess desde la
              configuración de seguridad de su cuenta de Google.
            </p>
            <p>
              FotoChess utiliza los datos obtenidos de las API de Google
              exclusivamente para prestar las funciones de Google Drive
              solicitadas por el usuario. Estos datos no se utilizan para
              publicidad, elaboración de perfiles comerciales ni finalidades
              ajenas al servicio.
            </p>
          </>
        ),
      },
      {
        heading: "8. Análisis de las partidas",
        body: (
          <>
            <p>
              Cuando el usuario activa el análisis, FotoChess envía a su propio
              servidor únicamente las posiciones de ajedrez necesarias para
              efectuar el cálculo.
            </p>
            <p>En este proceso:</p>
            <ul>
              <li>no se envía la imagen de la planilla;</li>
              <li>
                no se envían los nombres de los jugadores ni otros metadatos
                personales;
              </li>
              <li>
                las posiciones no se envían a un servicio externo de análisis;
              </li>
              <li>
                el resultado se devuelve al navegador para mostrarlo al usuario.
              </li>
            </ul>
          </>
        ),
      },
      {
        heading: "9. Datos almacenados en el dispositivo",
        body: (
          <>
            <p>
              FotoChess utiliza el almacenamiento local del navegador para
              conservar:
            </p>
            <ul>
              <li>el nombre del jugador;</li>
              <li>el correo electrónico opcional;</li>
              <li>los idiomas seleccionados;</li>
              <li>el formato de planilla;</li>
              <li>el identificador aleatorio del dispositivo;</li>
              <li>algunas preferencias de la interfaz;</li>
              <li>el identificador de la carpeta de Google Drive.</li>
            </ul>
            <p>
              Estos datos permanecen en el dispositivo hasta que el usuario
              modifica la configuración o elimina los datos del sitio desde el
              navegador.
            </p>
            <p>
              El correo electrónico introducido en Configuración no se envía
              automáticamente al servidor ni se utiliza para crear una cuenta.
            </p>
          </>
        ),
      },
      {
        heading: "10. Sugerencias y comunicaciones",
        body: (
          <>
            <p>
              La opción «Enviar sugerencia» abre el programa de correo del
              usuario.
            </p>
            <p>
              FotoChess no envía automáticamente el mensaje ni conserva una
              copia en el servidor de la aplicación.
            </p>
            <p>
              Si el usuario decide enviarlo, el mensaje será recibido en el
              correo de contacto de FotoChess y se conservará durante el tiempo
              necesario para responder, gestionar la incidencia y atender
              posibles responsabilidades.
            </p>
          </>
        ),
      },
      {
        heading: "11. Cookies, analítica y publicidad",
        body: (
          <>
            <p>FotoChess:</p>
            <ul>
              <li>
                no utiliza Google Analytics ni otros sistemas de analítica de
                comportamiento;
              </li>
              <li>no realiza seguimiento publicitario;</li>
              <li>no crea perfiles comerciales;</li>
              <li>no vende datos;</li>
              <li>
                no utiliza cookies de sesión para identificar personalmente a
                los usuarios.
              </li>
            </ul>
            <p>
              Puede utilizarse una cookie técnica o almacenamiento equivalente
              exclusivamente para recordar el estado de algún elemento de la
              interfaz. Esta información no se utiliza para rastrear al usuario.
            </p>
            <p>
              El proveedor de alojamiento puede generar registros técnicos, como
              direcciones IP, tipo de navegador o información de errores, de
              acuerdo con sus propias políticas de seguridad y conservación.
            </p>
          </>
        ),
      },
      {
        heading: "12. Destinatarios y proveedores",
        body: (
          <>
            <p>Los datos solo pueden ser tratados por:</p>
            <ul>
              <li>
                el proveedor de alojamiento e infraestructura de FotoChess;
              </li>
              <li>
                los proveedores tecnológicos necesarios para procesar
                temporalmente la planilla;
              </li>
              <li>Google, cuando el usuario utilice Google Drive;</li>
              <li>
                el proveedor de correo electrónico, cuando el usuario envíe
                voluntariamente una sugerencia.
              </li>
            </ul>
            <p>
              FotoChess no cede datos a terceros para finalidades comerciales,
              publicitarias o de venta de información.
            </p>
            <p>
              Algunos proveedores pueden procesar información fuera del Espacio
              Económico Europeo. En estos casos, el tratamiento se realizará
              conforme a los mecanismos y garantías exigidos por la normativa
              aplicable.
            </p>
          </>
        ),
      },
      {
        heading: "13. Conservación",
        body: (
          <>
            <p>Los criterios de conservación son:</p>
            <ul>
              <li>
                imágenes y partidas temporales: mientras resulten necesarias en
                la memoria operativa del servicio; desaparecen cuando el
                servidor se reinicia o vuelve a desplegarse;
              </li>
              <li>
                archivos temporales de procesamiento: se eliminan después de
                completar el procesamiento;
              </li>
              <li>
                configuración local: hasta que el usuario la elimina del
                navegador;
              </li>
              <li>
                Google Drive: hasta que el usuario elimina los archivos de su
                cuenta;
              </li>
              <li>
                tokens de Google: durante su vigencia temporal en el navegador;
              </li>
              <li>
                sugerencias: durante el tiempo necesario para responder y
                gestionar la comunicación;
              </li>
              <li>
                registros técnicos: según los plazos del proveedor de
                alojamiento y las necesidades de seguridad.
              </li>
            </ul>
            <p>
              Los datos se conservarán únicamente durante el tiempo necesario
              para cumplir la finalidad que justifica su tratamiento.
            </p>
          </>
        ),
      },
      {
        heading: "14. Seguridad",
        body: (
          <>
            <p>
              FotoChess aplica medidas destinadas a limitar el acceso no
              autorizado y proteger los datos durante la transmisión y el
              tratamiento.
            </p>
            <p>Entre otras medidas:</p>
            <ul>
              <li>
                separa las partidas temporales mediante identificadores
                aleatorios de dispositivo;
              </li>
              <li>evita mostrar las partidas de un dispositivo a otro;</li>
              <li>no almacena permanentemente los tokens de Google;</li>
              <li>
                limita el acceso de Google Drive a los archivos gestionados por
                la aplicación;
              </li>
              <li>
                evita registrar el contenido completo de las imágenes en los
                mensajes técnicos de la aplicación.
              </li>
            </ul>
            <p>
              Ningún servicio de Internet puede garantizar una seguridad
              absoluta, pero FotoChess adopta medidas proporcionadas a las
              características del servicio.
            </p>
          </>
        ),
      },
      {
        heading: "15. Derechos del usuario",
        body: (
          <>
            <p>El usuario puede ejercer los derechos de:</p>
            <ul>
              <li>acceso;</li>
              <li>rectificación;</li>
              <li>supresión;</li>
              <li>limitación del tratamiento;</li>
              <li>oposición;</li>
              <li>portabilidad, cuando resulte aplicable;</li>
              <li>
                retirada del consentimiento, sin afectar a la licitud del
                tratamiento anterior.
              </li>
            </ul>
            <p>Para ejercer estos derechos, puede escribir a:</p>
            <p>
              <EmailLink />
            </p>
            <p>
              También puede presentar una reclamación ante la Agencia Española
              de Protección de Datos.
            </p>
          </>
        ),
      },
      {
        heading: "16. Modificaciones de la política",
        body: (
          <>
            <p>
              FotoChess puede actualizar esta Política de privacidad cuando
              cambien sus funcionalidades, los proveedores utilizados o las
              obligaciones legales aplicables.
            </p>
            <p>
              La versión vigente indicará siempre la fecha de la última
              actualización.
            </p>
            <p>
              Si un cambio afecta sustancialmente a la manera en que se tratan
              los datos, se informará a los usuarios de forma visible antes de
              aplicarlo.
            </p>
          </>
        ),
      },
    ],
  },

  en: {
    title: "FotoChess Privacy Policy",
    lastUpdated: "Last updated: July 26, 2026",
    backLink: "Back to FotoChess",
    intro:
      "FotoChess respects user privacy and processes only the data necessary to provide the requested features.",
    sections: [
      {
        heading: "1. Data controller",
        body: (
          <>
            <p>The data controller is:</p>
            <ul>
              <li>
                <strong>Controller:</strong> Marc Tortajada Vinyes, creator and
                person responsible for FotoChess
              </li>
              <li>
                <strong>Country:</strong> Spain
              </li>
              <li>
                <strong>Contact email:</strong> <EmailLink />
              </li>
            </ul>
            <p>
              This email address may be used for privacy enquiries or to
              exercise the rights recognised under applicable data protection
              law.
            </p>
          </>
        ),
      },
      {
        heading: "2. Data processed by FotoChess",
        body: (
          <>
            <p>
              Depending on the features used, FotoChess may process the
              following categories of data:
            </p>
            <ul>
              <li>
                images of chess scoresheets selected or photographed by the
                user;
              </li>
              <li>
                information written on the scoresheet, such as player names,
                tournament, date, result and moves;
              </li>
              <li>
                the generated PGN, moves, corrections and game positions;
              </li>
              <li>
                a randomly generated technical device identifier used to
                separate temporary games belonging to different users;
              </li>
              <li>
                configuration preferences, such as languages and scoresheet
                format;
              </li>
              <li>
                the player name and optional email address entered in Settings;
              </li>
              <li>
                data needed to connect FotoChess voluntarily to Google Drive;
              </li>
              <li>
                communications voluntarily sent by the user through the
                suggestion option;
              </li>
              <li>
                technical data strictly necessary for the operation, security
                and diagnosis of service errors.
              </li>
            </ul>
            <p>
              FotoChess does not request special categories of personal data and
              recommends that users do not include information on scoresheets
              that is not necessary to digitise the game.
            </p>
          </>
        ),
      },
      {
        heading: "3. How the scoresheet image is processed",
        body: (
          <>
            <p>
              The image is captured or selected from the user's device and
              transmitted temporarily to provide the requested digitisation
              service.
            </p>
            <p>During processing:</p>
            <ul>
              <li>
                the image may remain temporarily in the service's operational
                memory;
              </li>
              <li>
                it may be processed by technology providers strictly necessary
                to generate the result;
              </li>
              <li>
                the temporary file used during processing is deleted once that
                operation is completed;
              </li>
              <li>it is not added to a permanent FotoChess database.</li>
            </ul>
            <p>
              FotoChess does not publish the image, share it with other users or
              add it to any proprietary, shared or other-user-accessible library.
            </p>
            <p>
              FotoChess does not use images or games for advertising, does not
              sell them and does not voluntarily create or share datasets
              intended to train systems.
            </p>
            <p>
              Necessary technology providers may perform temporary technical
              retention in accordance with their own terms, security obligations
              and service configuration. FotoChess does not activate additional
              systems for the permanent storage of scoresheets.
            </p>
          </>
        ),
      },
      {
        heading: "4. Temporary games",
        body: (
          <>
            <p>
              While the user is working with a game, FotoChess temporarily
              keeps the following in the server's operational memory:
            </p>
            <ul>
              <li>the image needed to display the scoresheet;</li>
              <li>the provisional or final PGN;</li>
              <li>the detected moves;</li>
              <li>the corrections made;</li>
              <li>errors or points pending review;</li>
              <li>the game metadata.</li>
            </ul>
            <p>These temporary games:</p>
            <ul>
              <li>
                are separated using a randomly generated device identifier;
              </li>
              <li>are not visible to other users;</li>
              <li>are not stored in a permanent database;</li>
              <li>disappear when the server is restarted or redeployed;</li>
              <li>do not constitute a permanent FotoChess library.</li>
            </ul>
            <p>
              Closing the browser does not immediately remove this information
              from operational memory, but it does not turn it into a permanent
              file.
            </p>
          </>
        ),
      },
      {
        heading: "5. Purposes of processing",
        body: (
          <>
            <p>FotoChess processes data exclusively to:</p>
            <ul>
              <li>digitise a chess scoresheet;</li>
              <li>generate and allow correction of the PGN;</li>
              <li>display the game, moves and positions;</li>
              <li>allow the user to analyse the game voluntarily;</li>
              <li>allow the PGN to be copied, downloaded or exported;</li>
              <li>
                save and consult games in the user's Google Drive when
                requested;
              </li>
              <li>retain local configuration preferences;</li>
              <li>respond to suggestions or enquiries;</li>
              <li>
                maintain the security, stability and proper operation of the
                service.
              </li>
            </ul>
            <p>
              Data is not used to create commercial profiles, display
              personalised advertising or make automated decisions that produce
              legal effects for the user.
            </p>
          </>
        ),
      },
      {
        heading: "6. Legal basis",
        body: (
          <>
            <p>
              The main legal basis is the provision of the service and
              performance of the features voluntarily requested by the user.
            </p>
            <p>
              When the user activates an optional feature, such as Google Drive
              or sending a suggestion, processing is also based on the user's
              explicit action and authorisation.
            </p>
            <p>
              Processing strictly necessary to maintain security, prevent abuse
              and diagnose errors is based on the legitimate interest in keeping
              the service safe and operational.
            </p>
          </>
        ),
      },
      {
        heading: "7. Google Drive",
        body: (
          <>
            <p>Connecting to Google Drive is entirely optional.</p>
            <p>
              FotoChess requests authorisation only when the user decides to
              save or view their games.
            </p>
            <p>When the user activates this feature:</p>
            <ul>
              <li>
                the PGN is saved directly to the user's own Google Drive
                account;
              </li>
              <li>
                the original image is saved only when the user expressly selects
                this option;
              </li>
              <li>the option to save the image is disabled by default;</li>
              <li>
                files are saved to the user's own Google Drive account inside
                the "Chess Games" folder;
              </li>
              <li>
                FotoChess accesses only files created or managed through the
                application;
              </li>
              <li>
                FotoChess does not obtain general access to the other files in
                the user's Google Drive;
              </li>
              <li>
                the access token remains temporarily in the browser and is not
                stored on the FotoChess server;
              </li>
              <li>
                FotoChess does not retain an additional copy of files merely
                because they are saved to Drive.
              </li>
            </ul>
            <p>
              Files saved in Google Drive remain under the user's control until
              the user decides to delete them.
            </p>
            <p>
              The user may revoke FotoChess access through their Google Account
              security settings.
            </p>
            <p>
              FotoChess uses data obtained from Google APIs exclusively to
              provide the Google Drive features requested by the user. This data
              is not used for advertising, commercial profiling or purposes
              unrelated to the service.
            </p>
          </>
        ),
      },
      {
        heading: "8. Game analysis",
        body: (
          <>
            <p>
              When the user activates analysis, FotoChess sends only the chess
              positions needed to perform the calculation to its own server.
            </p>
            <p>During this process:</p>
            <ul>
              <li>the scoresheet image is not sent;</li>
              <li>
                player names and other personal metadata are not sent;
              </li>
              <li>
                positions are not sent to an external analysis service;
              </li>
              <li>
                the result is returned to the browser for display to the user.
              </li>
            </ul>
          </>
        ),
      },
      {
        heading: "9. Data stored on the device",
        body: (
          <>
            <p>FotoChess uses browser local storage to retain:</p>
            <ul>
              <li>player name;</li>
              <li>optional email address;</li>
              <li>selected languages;</li>
              <li>scoresheet format;</li>
              <li>the randomly generated device identifier;</li>
              <li>certain interface preferences;</li>
              <li>the Google Drive folder identifier.</li>
            </ul>
            <p>
              This data remains on the device until the user changes the
              settings or deletes the site data from the browser.
            </p>
            <p>
              The email address entered in Settings is not automatically sent to
              the server and is not used to create an account.
            </p>
          </>
        ),
      },
      {
        heading: "10. Suggestions and communications",
        body: (
          <>
            <p>
              The "Send suggestion" option opens the user's email application.
            </p>
            <p>
              FotoChess does not automatically send the message or retain a copy
              on the application server.
            </p>
            <p>
              If the user chooses to send it, the message will be received at
              the FotoChess contact email address and retained for as long as
              necessary to respond, manage the issue and address possible
              liabilities.
            </p>
          </>
        ),
      },
      {
        heading: "11. Cookies, analytics and advertising",
        body: (
          <>
            <p>FotoChess:</p>
            <ul>
              <li>
                does not use Google Analytics or other behavioural analytics
                systems;
              </li>
              <li>does not perform advertising tracking;</li>
              <li>does not create commercial profiles;</li>
              <li>does not sell data;</li>
              <li>
                does not use session cookies to personally identify users.
              </li>
            </ul>
            <p>
              A technical cookie or equivalent storage may be used exclusively
              to remember the state of an interface element. This information is
              not used to track the user.
            </p>
            <p>
              The hosting provider may generate technical logs, such as IP
              addresses, browser type or error information, in accordance with
              its own security and retention policies.
            </p>
          </>
        ),
      },
      {
        heading: "12. Recipients and providers",
        body: (
          <>
            <p>Data may be processed only by:</p>
            <ul>
              <li>FotoChess's hosting and infrastructure provider;</li>
              <li>
                technology providers necessary to process the scoresheet
                temporarily;
              </li>
              <li>Google, when the user uses Google Drive;</li>
              <li>
                the email provider, when the user voluntarily sends a
                suggestion.
              </li>
            </ul>
            <p>
              FotoChess does not disclose data to third parties for commercial,
              advertising or data-sale purposes.
            </p>
            <p>
              Some providers may process information outside the European
              Economic Area. In such cases, processing will be carried out in
              accordance with the mechanisms and safeguards required by
              applicable law.
            </p>
          </>
        ),
      },
      {
        heading: "13. Retention",
        body: (
          <>
            <p>The retention criteria are:</p>
            <ul>
              <li>
                temporary images and games: while necessary in the service's
                operational memory; they disappear when the server is restarted
                or redeployed;
              </li>
              <li>
                temporary processing files: deleted after processing has been
                completed;
              </li>
              <li>
                local configuration: until the user deletes it from the browser;
              </li>
              <li>
                Google Drive: until the user deletes the files from their
                account;
              </li>
              <li>
                Google tokens: for their temporary validity period in the
                browser;
              </li>
              <li>
                suggestions: for as long as necessary to respond and manage the
                communication;
              </li>
              <li>
                technical logs: according to the hosting provider's retention
                periods and security needs.
              </li>
            </ul>
            <p>
              Data will be retained only for the time necessary to fulfil the
              purpose that justifies its processing.
            </p>
          </>
        ),
      },
      {
        heading: "14. Security",
        body: (
          <>
            <p>
              FotoChess applies measures intended to limit unauthorised access
              and protect data during transmission and processing.
            </p>
            <p>These measures include:</p>
            <ul>
              <li>
                separating temporary games through randomly generated device
                identifiers;
              </li>
              <li>
                preventing games from one device from being displayed on
                another;
              </li>
              <li>not storing Google tokens permanently;</li>
              <li>
                limiting Google Drive access to files managed by the
                application;
              </li>
              <li>
                avoiding logging the full content of images in the application's
                technical messages.
              </li>
            </ul>
            <p>
              No Internet service can guarantee absolute security, but FotoChess
              adopts measures proportionate to the characteristics of the
              service.
            </p>
          </>
        ),
      },
      {
        heading: "15. User rights",
        body: (
          <>
            <p>Users may exercise the rights of:</p>
            <ul>
              <li>access;</li>
              <li>rectification;</li>
              <li>erasure;</li>
              <li>restriction of processing;</li>
              <li>objection;</li>
              <li>portability, where applicable;</li>
              <li>
                withdrawal of consent, without affecting the lawfulness of
                previous processing.
              </li>
            </ul>
            <p>To exercise these rights, users may write to:</p>
            <p>
              <EmailLink />
            </p>
            <p>
              Users may also lodge a complaint with the Spanish Data Protection
              Agency.
            </p>
          </>
        ),
      },
      {
        heading: "16. Changes to this policy",
        body: (
          <>
            <p>
              FotoChess may update this Privacy Policy when its features,
              service providers or applicable legal obligations change.
            </p>
            <p>
              The current version will always indicate the date of the latest
              update.
            </p>
            <p>
              If a change substantially affects how data is processed, users
              will be informed visibly before it is applied.
            </p>
          </>
        ),
      },
    ],
  },
};

// ─── Lang selector labels ─────────────────────────────────────────────────────

const LANG_LABELS: Record<Lang, string> = {
  ca: "Català",
  es: "Español",
  en: "English",
};

// ─── Page component ───────────────────────────────────────────────────────────

export default function Privacy() {
  const [lang, setLang] = useState<Lang>("ca");

  useEffect(() => {
    setLang(readStoredLang());
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const content = CONTENT[lang];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-display font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
          >
            FotoChess
          </Link>

          {/* Language selector */}
          <nav aria-label="Language selector" className="flex items-center gap-1 text-xs text-muted-foreground">
            {(["ca", "es", "en"] as Lang[]).map((l, i) => (
              <span key={l} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">·</span>}
                <button
                  onClick={() => setLang(l)}
                  className={`hover:text-foreground transition-colors px-0.5 ${
                    lang === l ? "text-foreground font-medium" : ""
                  }`}
                  aria-current={lang === l ? "true" : undefined}
                >
                  {LANG_LABELS[l]}
                </button>
              </span>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-display font-bold mb-1">{content.title}</h1>
        <p className="text-xs text-muted-foreground mb-6">{content.lastUpdated}</p>

        <p className="text-sm leading-relaxed text-muted-foreground mb-8">
          {content.intro}
        </p>

        <div className="space-y-8">
          {content.sections.map((section) => (
            <section key={section.heading} aria-labelledby={section.heading}>
              <h2 className="text-base font-semibold mb-3">{section.heading}</h2>
              <div className="text-sm leading-relaxed text-muted-foreground space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:leading-relaxed [&_strong]:text-foreground">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        {/* Back link */}
        <div className="mt-12 pt-6 border-t border-border">
          <Link
            href="/"
            className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
          >
            ← {content.backLink}
          </Link>
        </div>
      </main>
    </div>
  );
}
