// VARIABILI GLOBALI
let partecipanti = {};
const STORAGE_KEY_NOMI = 'televotoNomiOnline';
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/modve7uqqwetx'; // *** INCOLLA IL TUO URL QUI ***

// Variabile per l'ID di sessione, generata al caricamento della pagina per distinguere i voti
const SESSION_ID = Date.now(); 

// Variabile booleana per la modalità test (salvata in localStorage)
let IS_TEST_MODE = JSON.parse(localStorage.getItem('isTestMode')) || true; 

// --- FUNZIONI DI GESTIONE ---

function toggleTestMode() {
    IS_TEST_MODE = !IS_TEST_MODE;
    localStorage.setItem('isTestMode', IS_TEST_MODE);
    aggiornaStatoModale();
    alert(`Modalità impostata su: ${IS_TEST_MODE ? 'TEST' : 'NORMALE'}. Ricarica la pagina di voto sui dispositivi se necessario.`);
}

function aggiornaStatoModale() {
    const btn = document.getElementById('modeToggle');
    const indicator = document.getElementById('testModeIndicator');
    
    btn.textContent = `Modalità: ${IS_TEST_MODE ? 'Test' : 'Normale'}`;
    indicator.textContent = `Modalità Corrente: ${IS_TEST_MODE ? 'Test (Voto Multiplo Abilitato)' : 'Normale (Voto Singolo)'}`;
    
    if (IS_TEST_MODE) {
        btn.style.backgroundColor = 'orange';
        indicator.style.backgroundColor = '#ffc107'; 
    } else {
        btn.style.backgroundColor = '#28a745';
        indicator.style.backgroundColor = '#28a745';
    }
}

// 1. Carica la lista dei nomi dal localStorage
function caricaPartecipanti() {
    const nomiSalvati = localStorage.getItem(STORAGE_KEY_NOMI);
    if (nomiSalvati) {
        let nomi = JSON.parse(nomiSalvati);
        nomi.forEach(nome => partecipanti[nome] = []);
    }
    aggiornaStatoModale();
    aggiornaInterfaccia();
}

// 2. Salva solo la lista dei nomi nel localStorage
function salvaNomi() {
    const nomiArray = Object.keys(partecipanti);
    localStorage.setItem(STORAGE_KEY_NOMI, JSON.stringify(nomiArray));
}

// 3. Aggiunge un nuovo partecipante
function aggiungiPartecipante() {
    const nomeInput = document.getElementById('nomeInput');
    const nome = nomeInput.value.trim();

    if (!nome) {
        alert("Inserisci un nome valido.");
        return;
    }
    if (Object.keys(partecipanti).length >= 25) {
        alert("Limite massimo di 25 partecipanti raggiunto.");
        return;
    }
    
    if (nome && !partecipanti[nome]) {
        partecipanti[nome] = [];
        salvaNomi();
        aggiornaInterfaccia();
        nomeInput.value = '';
    } else if (partecipanti[nome]) {
        alert('Nome già presente!');
    }
}

// 4. Aggiorna l'interfaccia utente (come card)
function aggiornaInterfaccia() {
    const listaDiv = document.getElementById('listaPartecipanti');
    listaDiv.innerHTML = '';

    for (const nome in partecipanti) {
        const card = document.createElement('div');
        card.className = 'partecipante-card';
        card.setAttribute('data-nome', nome);
        card.onclick = () => apriModaleQr(nome);

        card.innerHTML = `
            <button class="remove-btn" onclick="event.stopPropagation(); rimuoviPartecipante('${nome}')">✖</button>
            <h3>${nome}</h3>
            <p>Voti Registrati: ${partecipanti[nome].length}</p>
        `;
        listaDiv.appendChild(card);
    }
}

// --- GESTIONE MODALE ---

function apriModaleQr(nome) {
    const modal = document.getElementById('qrModal');
    const modalNome = document.getElementById('modalNome');
    const qrCanvas = document.getElementById('modalQrCanvas');
    
    const baseUrl = window.location.href.split('?')[0].split('index.html')[0]; 
    
    // L'URL di voto include l'ID di sessione e lo stato della modalità test
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

function chiudiModale(event) {
    const modal = document.getElementById('qrModal');
    // Chiude solo se si clicca sul pulsante OK o sull'area scura (sfondo)
    if (event && event.target !== modal) return;
    modal.style.display = 'none';
}


function rimuoviPartecipante(nome) {
    if (confirm(`Sei sicuro di voler rimuovere ${nome}? Questo non cancella i voti passati dal database, ma non li conteggerà.`)) {
        delete partecipanti[nome];
        salvaNomi();
        aggiornaInterfaccia();
    }
}


// --- FUNZIONI DI CALCOLO E CLASSIFICA ---

// Calcola la MEDIA dei voti (NUOVO OBIETTIVO) e mostra la classifica
async function calcolaMediaEVaiAllaClassifica() {
    alert('Calcolo della Media Voti e preparazione della classifica...');
    
    try {
        const response = await fetch(SHEETDB_API_URL); 
        if (!response.ok) {
            throw new Error(`Errore HTTP ${response.status}. Controlla che l'URL API sia corretto.`);
        }
        
        const allVoti = await response.json(); 
        let risultatiMedia = {};
        let votiRaw = {}; // {nome: [voti]}
        
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
                // Calcola la media e la arrotonda a due decimali
                risultatiMedia[nome] = parseFloat((somma / totaleVoti).toFixed(2));
            } else {
                risultatiMedia[nome] = 0; // Se non ci sono voti, la media è 0
            }
        }
        
        // 4. Ordina e visualizza la classifica
        visualizzaClassifica(risultatiMedia);

    } catch (error) {
        console.error("Errore nel calcolo o nel recupero dei dati:", error);
        alert(`ERRORE: Impossibile calcolare la media e la classifica. Controlla la console del browser per i dettagli.`);
    }
}

// Funzione di visualizzazione con i dati della media calcolata
function visualizzaClassifica(risultatiMedia) {
    const classificaDiv = document.getElementById('classifica');
    const listaClassifica = document.getElementById('listaClassifica');
    listaClassifica.innerHTML = '';
    
    // Converte l'oggetto in un array e ordina in modo DECRESCENTE per media
    const classificaArray = Object.entries(risultatiMedia)
        .sort(([, mediaA], [, mediaB]) => mediaB - mediaA);

    classificaArray.forEach(([nome, media], index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="rank">${index + 1}.</span>
            <span class="nome">${nome}</span>
            <span class="avg">${media.toFixed(2)}</span>
        `;
        listaClassifica.appendChild(li);
    });

    classificaDiv.style.display = 'block';
    classificaDiv.scrollIntoView({ behavior: 'smooth' });
}


// 7. FUNZIONE DI RESET COMPLETO (Invariata)
async function resetCompleto() {
    if (!confirm("SEI SICURO? Questa operazione ELIMINERÀ TUTTI I VOTI dal Foglio Google e pulirà la lista dei nomi. NON è reversibile.")) {
        return;
    }

    try {
        // 7a. Cancella tutti i record dal Foglio Google
        const deleteResponse = await fetch(`${SHEETDB_API_URL}/all`, {
            method: 'DELETE'
        });
        
        if (!deleteResponse.ok) {
            throw new Error(`Errore API DELETE: ${deleteResponse.status}`);
        }
        
        // 7b. Cancella i nomi dal localStorage
        localStorage.removeItem(STORAGE_KEY_NOMI);
        localStorage.removeItem('isTestMode'); // Resetta anche lo stato della modalità test
        
        alert("RESET COMPLETATO! Voti e lista nomi azzerati. La pagina verrà ricaricata per una nuova sessione.");
        location.reload();

    } catch (error) {
        console.error("Errore nel reset:", error);
        alert(`ERRORE GRAVE DURANTE IL RESET. Controlla la console. Voti NON azzerati: ${error.message}`);
    }
}
