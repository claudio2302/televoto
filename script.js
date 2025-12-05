// VARIABILI GLOBALI
let partecipanti = {};
const STORAGE_KEY_NOMI = 'televotoNomiOnline';
// *** URL API AGGIORNATO ***
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/modve7uqqwetx'; 

// Variabile booleana per la modalità test (IMPOSTABILE SOLO QUI)
const IS_TEST_MODE = true; // <-- Imposta su TRUE per voti multipli; FALSE per voto singolo.

// Variabile per l'ID di sessione, generata al caricamento della pagina
const SESSION_ID = Date.now(); 
const STORAGE_KEY_VISITED = 'televotoVisitedQr'; // Nuova chiave per tracciare i QR aperti

// --- FUNZIONI DI GESTIONE ---

// 1. Carica la lista dei nomi dal localStorage
function caricaPartecipanti() {
    const nomiSalvati = localStorage.getItem(STORAGE_KEY_NOMI);
    if (nomiSalvati) {
        let nomi = JSON.parse(nomiSalvati);
        nomi.forEach(nome => partecipanti[nome] = []);
    }
    aggiornaInterfaccia();
}

// 2. Salva solo la lista dei nomi nel localStorage
function salvaNomi() {
    const nomiArray = Object.keys(partecipanti);
    localStorage.setItem(STORAGE_KEY_NOMI, JSON.stringify(nomiArray));
}

// 3. Aggiunge un nuovo partecipante dalla modale
function aggiungiPartecipante(nome) {
    const nomeInput = nome.trim();

    if (!nomeInput) {
        alert("Inserisci un nome valido.");
        return false;
    }
    
    // Rimosso il limite di 25 partecipanti
    
    if (nomeInput && !partecipanti[nomeInput]) {
        partecipanti[nomeInput] = [];
        salvaNomi();
        aggiornaInterfaccia();
        return true;
    } else if (partecipanti[nomeInput]) {
        alert('Nome già presente!');
        return false;
    }
}

// 4. Aggiorna l'interfaccia utente (a colonna)
function aggiornaInterfaccia() {
    const listaDiv = document.getElementById('listaPartecipanti');
    listaDiv.innerHTML = '';
    
    const visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || '[]');

    for (const nome in partecipanti) {
        const card = document.createElement('div');
        card.className = 'partecipante-card';
        card.setAttribute('data-nome', nome);
        card.onclick = () => apriModaleQr(nome);
        
        if (visited.includes(nome)) {
            card.classList.add('visited');
        }

        card.innerHTML = `
            <h3>${nome}</h3>
            <button class="remove-btn" onclick="event.stopPropagation(); apriModaleConfermaElimina('${nome}')">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        listaDiv.appendChild(card);
    }
}

// --- GESTIONE MODALI ---

// Modale Inserimento Nome
function apriModaleInserimento() {
    document.getElementById('modalNomeInput').value = '';
    document.getElementById('inputModal').style.display = 'flex';
}

function salvaNomeDaModale() {
    const nome = document.getElementById('modalNomeInput').value;
    if (aggiungiPartecipante(nome)) {
        document.getElementById('inputModal').style.display = 'none';
    }
}

// Modale QR Code
function apriModaleQr(nome) {
    const modal = document.getElementById('qrModal');
    const modalNome = document.getElementById('modalNomeQr');
    const qrCanvas = document.getElementById('modalQrCanvas');
    
    // Aggiorna lo stato "visitato"
    let visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || '[]');
    if (!visited.includes(nome)) {
        visited.push(nome);
        localStorage.setItem(STORAGE_KEY_VISITED, JSON.stringify(visited));
        // Aggiorna la classe CSS della card
        const card = document.querySelector(`.partecipante-card[data-nome='${nome}']`);
        if (card) card.classList.add('visited');
    }

    const baseUrl = window.location.href.split('?')[0].split('index.html')[0]; 
    
    // L'URL include l'ID di sessione e lo stato della modalità test
    const urlVoto = `${baseUrl}voto.html?nome=${encodeURIComponent(nome)}&session=${SESSION_ID}&test=${IS_TEST_MODE}`;

    modalNome.textContent = nome;

    // Genera il QR Code nella modale
    new QRious({
        element: qrCanvas,
        value: urlVoto,
        size: 300,
        padding: 10
    });

    modal.style.display = 'flex';
}

// Chiusura Modali (gestita dal click fuori dalla modale-content)
function chiudiModale(event, id) {
    const modal = document.getElementById(id);
    // Chiude solo se il click è sullo sfondo (event.target è l'elemento più esterno)
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Modale Conferma Elimina (semplificata con confirm nativo)
function apriModaleConfermaElimina(nome) {
    if (confirm(`Sei sicuro di voler rimuovere ${nome}? Questo non cancella i voti passati dal database, ma non li conteggerà.`)) {
        rimuoviPartecipante(nome);
    }
}

function rimuoviPartecipante(nome) {
    delete partecipanti[nome];
    salvaNomi();
    aggiornaInterfaccia();
}


// --- FUNZIONI DI CALCOLO E CLASSIFICA ---

// Calcola la MEDIA dei voti e mostra la classifica
async function calcolaMediaEVaiAllaClassifica() {
    document.body.style.cursor = 'wait';
    
    try {
        const response = await fetch(SHEETDB_API_URL); 
        if (!response.ok) {
            throw new Error(`Errore HTTP ${response.status}. Controlla che l'URL API sia corretto.`);
        }
        
        const allVoti = await response.json(); 
        let risultatiMedia = {};
        let votiRaw = {}; 
        
        // 1. Inizializza i partecipanti noti
        for (const nome of Object.keys(partecipanti)) {
            votiRaw[nome] = [];
        }

        // 2. Raggruppa i voti
        allVoti.forEach(record => {
            const nome = record.nome;
            const voto = parseInt(record.voto); 
            
            if (votiRaw.hasOwnProperty(nome) && !isNaN(voto)) {
                votiRaw[nome].push(voto);
            }
        });
        
        // 3. Calcola la media e formatta
        for (const nome in votiRaw) {
            const voti = votiRaw[nome];
            const totaleVoti = voti.length;
            
            if (totaleVoti > 0) {
                const somma = voti.reduce((acc, voto) => acc + voto, 0);
                risultatiMedia[nome] = parseFloat((somma / totaleVoti).toFixed(2));
            } else {
                risultatiMedia[nome] = 0; // Media 0 se nessun voto
            }
        }
        
        // 4. Visualizza la classifica e nasconde l'interfaccia principale
        visualizzaClassifica(risultatiMedia);
        document.body.style.cursor = 'default';

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Errore nel calcolo o nel recupero dei dati:", error);
        alert(`ERRORE: Impossibile calcolare la media e la classifica. Controlla la console.`);
    }
}

// Funzione di visualizzazione con i dati della media calcolata
function visualizzaClassifica(risultatiMedia) {
    const classificaView = document.getElementById('classifica-view');
    const mainContainer = document.getElementById('main-container');
    const listaClassifica = document.getElementById('listaClassifica');
    
    listaClassifica.innerHTML = '';
    
    // Ordina in modo DECRESCENTE (media più alta in cima)
    const classificaArray = Object.entries(risultatiMedia)
        .sort(([, mediaA], [, mediaB]) => mediaB - mediaA);

    classificaArray.forEach(([nome, media], index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="rank">${index + 1}.</span>
            <span class="name">${nome}</span>
            <span class="avg">${media.toFixed(2)}</span>
        `;
        listaClassifica.appendChild(li);
    });

    // Nasconde l'interfaccia principale e mostra la classifica pulita
    mainContainer.style.display = 'none';
    classificaView.style.display = 'flex';
}


// 7. FUNZIONE DI RESET COMPLETO
async function resetCompleto() {
    if (!confirm("SEI SICURO? QUESTA È UN'OPERAZIONE DI ELIMINAZIONE PERMANENTE. I voti saranno cancellati dal Foglio Google e la lista nomi azzerata.")) {
        return;
    }

    document.body.style.cursor = 'wait';

    try {
        // 7a. Cancella tutti i record dal Foglio Google
        const deleteResponse = await fetch(`${SHEETDB_API_URL}/all`, {
            method: 'DELETE'
        });
        
        if (!deleteResponse.ok) {
            throw new Error(`Errore API DELETE: ${deleteResponse.status}`);
        }
        
        // 7b. Cancella i nomi e i flag di visita dal localStorage
        localStorage.removeItem(STORAGE_KEY_NOMI);
        localStorage.removeItem(STORAGE_KEY_VISITED);
        
        alert("RESET COMPLETATO! Nuova sessione iniziata.");
        location.reload(); // Ricarica la pagina per resettare l'ID di sessione

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Errore nel reset:", error);
        alert(`ERRORE GRAVE DURANTE IL RESET. Voti NON azzerati: ${error.message}`);
    }
}
