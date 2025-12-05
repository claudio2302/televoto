// VARIABILI GLOBALI
let partecipanti = {};
const STORAGE_KEY_NOMI = 'televotoNomiOnline';
// *** URL API AGGIORNATO ***
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/modve7uqqwetx'; 

// Variabile booleana per la modalità test (IMPOSTABILE SOLO QUI)
const IS_TEST_MODE = false; // <-- Imposta su TRUE per voti multipli; FALSE per voto singolo.

// Variabile per l'ID di sessione, generata al caricamento della pagina per distinguere i voti
const SESSION_ID = Date.now(); 
const STORAGE_KEY_VISITED = 'televotoVisitedQr'; 

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

// Modale Inserimento Nome (AGGIUNTO AUTOFOCUS E GESTIONE TASTO INVIO)
function apriModaleInserimento() {
    const inputField = document.getElementById('modalNomeInput');
    inputField.value = '';
    
    document.getElementById('inputModal').style.display = 'flex';
    inputField.focus(); // Focus immediato
    
    // Aggiunge un listener temporaneo per il tasto Invio
    inputField.addEventListener('keydown', function handleEnter(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            salvaNomeDaModale();
            // Rimuove il listener dopo l'uso
            inputField.removeEventListener('keydown', handleEnter);
        }
    });
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

// Chiusura Modali: Chiusura solo cliccando sullo sfondo
function chiudiModale(event, id) {
    const modal = document.getElementById(id);
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
    // Pulisce anche il flag "visitato"
    let visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || '[]');
    localStorage.setItem(STORAGE_KEY_VISITED, JSON.stringify(visited.filter(n => n !== nome)));
    aggiornaInterfaccia();
}


// --- FUNZIONI DI CALCOLO E CLASSIFICA ---

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
        
        for (const nome of Object.keys(partecipanti)) {
            votiRaw[nome] = [];
        }

        allVoti.forEach(record => {
            const nome = record.nome;
            const voto = parseInt(record.voto); 
            
            if (votiRaw.hasOwnProperty(nome) && !isNaN(voto)) {
                votiRaw[nome].push(voto);
            }
        });
        
        for (const nome in votiRaw) {
            const voti = votiRaw[nome];
            const totaleVoti = voti.length;
            
            if (totaleVoti > 0) {
                const somma = voti.reduce((acc, voto) => acc + voto, 0);
                risultatiMedia[nome] = parseFloat((somma / totaleVoti).toFixed(2));
            } else {
                risultatiMedia[nome] = 0;
            }
        }
        
        visualizzaClassifica(risultatiMedia);
        document.body.style.cursor = 'default';

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Errore nel calcolo o nel recupero dei dati:", error);
        alert(`ERRORE: Impossibile calcolare la media e la classifica.`);
    }
}

// Funzione di visualizzazione che nasconde l'interfaccia principale
function visualizzaClassifica(risultatiMedia) {
    const classificaView = document.getElementById('classifica-view');
    const mainView = document.getElementById('main-view');
    const classificaBtn = document.getElementById('classificaBtn');
    const listaClassifica = document.getElementById('listaClassifica');
    
    listaClassifica.innerHTML = '';
    
    const classificaArray = Object.entries(risultatiMedia)
        .sort(([, mediaA], [, mediaB]) => mediaB - mediaA); // Ordine decrescente (dal più alto al più basso)

    classificaArray.forEach(([nome, media], index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="rank">${index + 1}.</span>
            <span class="name">${nome}</span>
            <span class="avg">${media.toFixed(2)}</span>
        `;
        listaClassifica.appendChild(li);
    });

    // Nasconde l'interfaccia principale e il pulsante Classifica
    mainView.style.display = 'none';
    classificaBtn.style.display = 'none';
    
    // Mostra la classifica pulita
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
        location.reload(); 

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Errore nel reset:", error);
        alert(`ERRORE GRAVE DURANTE IL RESET. Voti NON azzerati: ${error.message}`);
    }
}
