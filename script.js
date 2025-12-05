// VARIABILI GLOBALI
let partecipanti = {};
const STORAGE_KEY_NOMI = 'televotoNomiOnline';

// Variabile booleana per la modalità test
const IS_TEST_MODE = false; 

// Variabile per l'ID di sessione
const SESSION_ID = Date.now(); 
const STORAGE_KEY_VISITED = 'televotoVisitedQr'; 
let votiCorrenti = {}; 

// --- FUNZIONI DI UTILITÀ PER FIREBASE (da SDK v9) ---
// Utilizziamo le funzioni globali rese disponibili dal blocco <script type="module"> in index.html
const db = window.db; 
const VOTI_COLLECTION = window.VOTI_COLLECTION; 

// Importa i moduli da Firebase SDK v9.6.1
const firestore = {
    getDocs: async (query) => {
        const { getDocs: importedGetDocs } = await import('https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js');
        return importedGetDocs(query);
    },
    collection: (db, path) => {
        const { collection: importedCollection } = window.firebaseFirestore || {};
        if (importedCollection) return importedCollection(db, path);
        // Fallback per garantire che le chiamate Collection/Query funzionino correttamente
        return { 
            get: () => {
                const { collection } = window.firebaseFirestore; 
                return collection(db, path).get();
            }
        };
    },
    query: (collectionRef) => {
        const { query: importedQuery } = window.firebaseFirestore || {};
        if (importedQuery) return importedQuery(collectionRef);
        return collectionRef;
    },
    // Funzione modificata per usare la sintassi corretta
    getDocsFromCollection: async (collectionPath) => {
        const { collection: importedCollection, getDocs: importedGetDocs } = await import('https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js');
        const colRef = importedCollection(db, collectionPath);
        return importedGetDocs(colRef);
    },
    
    // Funzioni per la classfica e reset
    serverTimestamp: () => ({}), // Placeholder
    writeBatch: async () => {
        const { writeBatch: importedWriteBatch } = await import('https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js');
        return importedWriteBatch(db);
    }
};

// --- FUNZIONI DI BASE ---

function capitalizeWords(str) {
    if (!str) return str;
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

// Funzione per scaricare i voti e aggiornare la mappa votiCorrenti (UTILIZZA FIREBASE)
async function caricaConteggiVoti() {
    if (!window.db) return;

    try {
        const snapshot = await firestore.getDocsFromCollection(VOTI_COLLECTION);
        const conteggi = {};
        
        for (const nome of Object.keys(partecipanti)) {
            conteggi[nome] = 0;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const nome = data.nome;
            if (conteggi.hasOwnProperty(nome)) {
                conteggi[nome] += 1;
            }
        });

        votiCorrenti = conteggi;
        aggiornaInterfaccia(); 

    } catch (error) {
        console.error("Impossibile caricare i conteggi dei voti da Firebase:", error);
    }
}

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
    const nomeCapitalizzato = capitalizeWords(nome.trim());

    if (!nomeCapitalizzato) {
        alert("Inserisci un nome valido.");
        return false;
    }
    
    if (nomeCapitalizzato && !partecipanti[nomeCapitalizzato]) {
        partecipanti[nomeCapitalizzato] = [];
        salvaNomi();
        votiCorrenti[nomeCapitalizzato] = 0; 
        aggiornaInterfaccia();
        return true;
    } else if (partecipanti[nomeCapitalizzato]) {
        alert('Nome già presente!');
        return false;
    }
}

// 4. Aggiorna l'interfaccia utente
function aggiornaInterfaccia() {
    const listaDiv = document.getElementById('listaPartecipanti');
    listaDiv.innerHTML = '';
    
    const visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || '[]');

    for (const nome in partecipanti) {
        const conteggio = votiCorrenti[nome] || 0; 
        
        const card = document.createElement('div');
        card.className = 'partecipante-card';
        card.setAttribute('data-nome', nome);
        card.onclick = () => apriModaleQr(nome);
        
        if (visited.includes(nome)) {
            card.classList.add('visited');
        }

        card.innerHTML = `
            <h3>${nome}</h3>
            <div class="partecipante-info">
                <span class="vote-count" style="color: white; font-weight: 600;">${conteggio} voti</span>
                <button class="remove-btn" onclick="event.stopPropagation(); apriModaleConfermaElimina('${nome}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        listaDiv.appendChild(card);
    }
}

// --- GESTIONE MODALI ---

let enterListener; 

function apriModaleInserimento() {
    // ... (Logica invariata)
    const inputField = document.getElementById('modalNomeInput');
    const modal = document.getElementById('inputModal');
    
    inputField.value = '';
    
    modal.style.display = 'flex';
    inputField.focus(); 
    
    if (enterListener) {
        inputField.removeEventListener('keydown', enterListener);
    }
    
    enterListener = function handleEnter(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            salvaNomeDaModale();
        }
    };
    inputField.addEventListener('keydown', enterListener);
}

function salvaNomeDaModale() {
    // ... (Logica invariata)
    const nome = document.getElementById('modalNomeInput').value;
    const inputField = document.getElementById('modalNomeInput');
    
    if (aggiungiPartecipante(nome)) {
        document.getElementById('inputModal').style.display = 'none';
        inputField.removeEventListener('keydown', enterListener);
    }
}

function apriModaleQr(nome) {
    // ... (Logica invariata, inclusa centratura QR)
    const modal = document.getElementById('qrModal');
    const modalNome = document.getElementById('modalNomeQr');
    const qrCanvas = document.getElementById('modalQrCanvas');
    
    let visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || '[]');
    if (!visited.includes(nome)) {
        visited.push(nome);
        localStorage.setItem(STORAGE_KEY_VISITED, JSON.stringify(visited));
        const card = document.querySelector(`.partecipante-card[data-nome='${nome}']`);
        if (card) card.classList.add('visited');
    }

    const pathArray = window.location.pathname.split('/');
    // Controlla se l'ultimo elemento è index.html o solo il repo name
    const baseUrl = window.location.href.split('?')[0].replace(/index\.html$/, ''); 

    // L'URL di voto ora usa il percorso relativo, che è più robusto per GitHub Pages
    const urlVoto = `${baseUrl}voto.html?nome=${encodeURIComponent(nome)}&session=${SESSION_ID}&test=${IS_TEST_MODE}`;

    modalNome.textContent = nome;

    new QRious({
        element: qrCanvas,
        value: urlVoto,
        size: 300,
        padding: 10
    });

    modal.style.display = 'flex';
}

function chiudiModale(event, id) {
    // ... (Logica invariata)
    const modal = document.getElementById(id);
    if (event.target === modal) {
        modal.style.display = 'none';
        
        if (id === 'inputModal') {
            const inputField = document.getElementById('modalNomeInput');
            if (enterListener) {
                 inputField.removeEventListener('keydown', enterListener);
            }
        }
    }
}

function apriModaleConfermaElimina(nome) {
    // ... (Logica invariata)
    if (confirm(`Sei sicuro di voler rimuovere ${nome}? Questo non cancella i voti passati dal database, ma non li conteggerà.`)) {
        rimuoviPartecipante(nome);
    }
}

function rimuoviPartecipante(nome) {
    // ... (Logica invariata)
    delete partecipanti[nome];
    delete votiCorrenti[nome]; 
    salvaNomi();
    let visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || '[]');
    localStorage.setItem(STORAGE_KEY_VISITED, JSON.stringify(visited.filter(n => n !== nome)));
    aggiornaInterfaccia();
}

// --- FUNZIONI DI CALCOLO E CLASSIFICA (UTILIZZANO FIREBASE) ---

async function calcolaMediaEVaiAllaClassifica() {
    if (!window.db) {
        alert("Il database non è stato ancora inizializzato. Riprova tra un secondo.");
        return;
    }
    
    document.body.style.cursor = 'wait';
    
    try {
        const snapshot = await firestore.getDocsFromCollection(VOTI_COLLECTION);
        
        let risultatiMedia = {};
        let votiRaw = {}; 
        
        for (const nome of Object.keys(partecipanti)) {
            votiRaw[nome] = [];
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const nome = data.nome;
            const voto = parseInt(data.voto); 
            
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
        console.error("Errore nel calcolo o nel recupero dei dati da Firebase:", error);
        alert(`ERRORE: Impossibile calcolare la media e la classifica. Dettaglio: ${error.message}`);
    }
}

function visualizzaClassifica(risultatiMedia) {
    // ... (Logica invariata)
    const classificaView = document.getElementById('classifica-view');
    const mainView = document.getElementById('main-view');
    const classificaBtn = document.getElementById('classificaBtn');
    const listaClassifica = document.getElementById('listaClassifica');
    
    listaClassifica.innerHTML = '';
    
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

    mainView.style.display = 'none';
    classificaBtn.style.display = 'none';
    
    classificaView.style.display = 'flex';
}


// 7. FUNZIONE DI RESET COMPLETO (UTILIZZA FIREBASE)
async function resetCompleto() {
    if (!window.db) {
        alert("Il database non è inizializzato.");
        return;
    }

    if (!confirm("SEI SICURO? QUESTA È UN'OPERAZIONE DI ELIMINAZIONE PERMANENTE. I voti saranno cancellati da Firebase e la lista nomi azzerata.")) {
        return;
    }

    document.body.style.cursor = 'wait';

    try {
        const batch = await firestore.writeBatch();
        const snapshot = await firestore.getDocsFromCollection(VOTI_COLLECTION);
        
        snapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        // Cancella i nomi e i flag di visita dal localStorage
        localStorage.removeItem(STORAGE_KEY_NOMI);
        localStorage.removeItem(STORAGE_KEY_VISITED);
        
        alert("RESET COMPLETATO! Nuova sessione iniziata. I voti su Firebase sono stati cancellati.");
        location.reload(); 

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Errore grave nel reset con Firebase:", error);
        alert(`ERRORE GRAVE DURANTE IL RESET. Voti NON azzerati. Dettagli: ${error.message}`);
    }
}
