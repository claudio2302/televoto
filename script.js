// VARIABILI GLOBALI
let partecipanti = {};
const STORAGE_KEY_NOMI = 'televotoNomiOnline';

// Variabile booleana per la modalità test
const IS_TEST_MODE = false; 

// Variabile per l'ID di sessione
const SESSION_ID = Date.now(); 
const STORAGE_KEY_VISITED = 'televotoVisitedQr'; 
let votiCorrenti = {}; 

// NOTE: db e VOTI_COLLECTION sono resi globali in firebase_init.js

// --- VARIABILI DI STATO CLASSIFICA (DALL'ESEMPIO) ---
window.finalRankingIndex = 0;
window.sortedFinalRanking = [];
window.podiumState = 0;
window.page3Active = false; // Flag per la tastiera
window.finalParticipantScores = []; // Dati grezzi per il calcolo

// --- FUNZIONI DI UTILITÀ ---

function capitalizeWords(str) {
    if (!str) return str;
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

// Funzione per scaricare i voti e aggiornare la mappa votiCorrenti
async function caricaConteggiVoti() {
    if (!window.db) return;

    try {
        const snapshot = await window.db.collection(window.VOTI_COLLECTION).get();
        
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

// --- FUNZIONI DI GESTIONE PRINCIPALE (omesse per brevità, sono invariate) ---

function caricaPartecipanti() {
    const nomiSalvati = localStorage.getItem(STORAGE_KEY_NOMI);
    if (nomiSalvati) {
        let nomi = JSON.parse(nomiSalvati);
        nomi.forEach(nome => partecipanti[nome] = []);
    }
    aggiornaInterfaccia();
}

function salvaNomi() {
    const nomiArray = Object.keys(partecipanti);
    localStorage.setItem(STORAGE_KEY_NOMI, JSON.stringify(nomiArray));
}

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

let enterListener; 
function apriModaleInserimento() {
    const inputField = document.getElementById('modalNomeInput');
    const modal = document.getElementById('inputModal');
    inputField.value = '';
    modal.style.display = 'flex';
    inputField.focus(); 
    if (enterListener) { inputField.removeEventListener('keydown', enterListener); }
    enterListener = function handleEnter(e) { if (e.key === 'Enter') { e.preventDefault(); salvaNomeDaModale(); } };
    inputField.addEventListener('keydown', enterListener);
}

function salvaNomeDaModale() {
    const nome = document.getElementById('modalNomeInput').value;
    const inputField = document.getElementById('modalNomeInput');
    if (aggiungiPartecipante(nome)) {
        document.getElementById('inputModal').style.display = 'none';
        inputField.removeEventListener('keydown', enterListener);
    }
}

function apriModaleQr(nome) {
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

    const baseUrl = window.location.href.split('?')[0].replace(/index\.html$/, ''); 
    const urlVoto = `${baseUrl}voto.html?nome=${encodeURIComponent(nome)}&session=${SESSION_ID}&test=${IS_TEST_MODE}`;

    modalNome.textContent = nome;
    new QRious({ element: qrCanvas, value: urlVoto, size: 300, padding: 10 });
    modal.style.display = 'flex';
}

function chiudiModale(event, id) {
    const modal = document.getElementById(id);
    if (event.target === modal) {
        modal.style.display = 'none';
        if (id === 'inputModal') {
            const inputField = document.getElementById('modalNomeInput');
            if (enterListener) { inputField.removeEventListener('keydown', enterListener); }
        }
    }
}

function apriModaleConfermaElimina(nome) {
    if (confirm(`Sei sicuro di voler rimuovere ${nome}? Questo non cancella i voti passati dal database, ma non li conteggerà.`)) {
        rimuoviPartecipante(nome);
    }
}

function rimuoviPartecipante(nome) {
    delete partecipanti[nome];
    delete votiCorrenti[nome]; 
    salvaNomi();
    let visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || '[]');
    localStorage.setItem(STORAGE_KEY_VISITED, JSON.stringify(visited.filter(n => n !== nome)));
    aggiornaInterfaccia();
}


// --------------------------------------------------------------------
// --- FUNZIONI DI CALCOLO E CLASSIFICA (INTEGRATE DAL TUO ESEMPIO) ---
// --------------------------------------------------------------------

async function calcolaMediaEVaiAllaClassifica() {
    if (!window.db) {
        alert("Il database non è stato ancora inizializzato. Riprova tra un secondo.");
        return;
    }
    
    document.body.style.cursor = 'wait';
    
    try {
        const colRef = window.db.collection(window.VOTI_COLLECTION);
        const snapshot = await colRef.get();
        
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
        
        let pScores = []; // Array temporaneo per il calcolo e l'ordinamento
        for (const nome in votiRaw) {
            const voti = votiRaw[nome];
            const totaleVoti = voti.length;
            
            let media = 0;
            if (totaleVoti > 0) {
                const somma = voti.reduce((acc, voto) => acc + voto, 0);
                media = parseFloat((somma / totaleVoti).toFixed(2));
            }
            
            pScores.push({ nome: nome, totale: media });
            risultatiMedia[nome] = media; // Salva la media nel formato precedente se servisse
        }
        
        // 1. Ordina per totale (media)
        pScores.sort((a, b) => b.totale - a.totale);

        // 2. Raggruppa i partecipanti per parimerito e assegna la posizione
        window.finalParticipantScores = [];
        let currentRank = 0;
        let lastScore = -Infinity;
        let tiedCount = 0;
        pScores.forEach((p) => {
            if (p.totale !== lastScore) {
                currentRank += (tiedCount + 1);
                lastScore = p.totale;
                tiedCount = 0;
            }
            window.finalParticipantScores.push({ ...p, posizione: currentRank });
        });
        
        // 3. Crea l'array per la rivelazione graduale (gruppi di parimerito)
        window.sortedFinalRanking = []; 
        let currentGroup = [];
        let currentScore = -Infinity;
        let currentPosition = 0;

        // Processa pScores (che è già ordinato)
        window.finalParticipantScores.forEach(p => {
            if (p.totale !== currentScore) {
                if (currentGroup.length > 0) {
                    window.sortedFinalRanking.push({
                        nomi: currentGroup.map(item => item.nome),
                        totale: currentScore,
                        posizione: currentPosition
                    });
                }
                currentPosition = p.posizione;
                currentGroup = [p];
                currentScore = p.totale;
            } else {
                currentGroup.push(p);
            }
        });
        // Aggiunge l'ultimo gruppo
        if (currentGroup.length > 0) {
            window.sortedFinalRanking.push({
                nomi: currentGroup.map(item => item.nome),
                totale: currentScore,
                posizione: currentPosition
            });
        }
        
        // Rivelazione graduale: la classifica inizia dal fondo (posizione più alta = indice 0)
        window.sortedFinalRanking.reverse();
        
        // 4. Inizia la presentazione dinamica
        window.finalRankingIndex = 0;
        window.podiumState = 0;
        goToFinalRankingView();
        
        document.body.style.cursor = 'default';

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Errore nel calcolo o nel recupero dei dati da Firebase:", error);
        alert(`ERRORE: Impossibile calcolare la media e la classifica. Controlla i permessi e la connessione Firebase.`);
    }
}

// Inizia la visualizzazione pulita della classifica
function goToFinalRankingView() { 
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('classificaBtn').style.display = 'none';
    
    const view = document.getElementById('classifica-view');
    view.style.display = 'flex';
    
    // Inizializzazione della vista a podio
    document.getElementById('ranking-list-container').innerHTML = '';
    document.getElementById('podiumContainer').style.display = 'none';
    document.getElementById('podiumContainer').classList.remove('visible'); 
    
    window.page3Active = true;
}

// Chiude la classifica e torna alla vista principale
window.closeFinalRankingView = function() {
    document.getElementById('classifica-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'block';
    document.getElementById('classificaBtn').style.display = 'block';
    window.page3Active = false;
    window.finalRankingIndex = 0;
    window.podiumState = 0;
    
    // Ricarica i conteggi per aggiornare la lista iniziale
    caricaConteggiVoti(); 
};

// Funzione che gestisce l'animazione graduale
window.showNextRankingRow = function() { 
    if (!window.page3Active) return; 
    
    const rList = document.getElementById('ranking-list-container');
    const pCont = document.getElementById('podiumContainer');
    
    const g1 = window.sortedFinalRanking.find(g => g.posizione === 1);
    const g2 = window.sortedFinalRanking.find(g => g.posizione === 2);
    const g3 = window.sortedFinalRanking.find(g => g.posizione === 3);

    // --- LOGICA DI TRANSIZIONE DALLA LISTA AL PODIO (Posizione 4) ---
    if (window.podiumState === 0) { 
        const threshPosition = 3; 
        
        // Se l'indice corrente è fuori dall'array O siamo arrivati al 4° classificato
        if (window.finalRankingIndex >= window.sortedFinalRanking.length || 
            (window.sortedFinalRanking[window.finalRankingIndex]?.posizione <= threshPosition)) { 
            
            // FASE 1: NASCONDI LISTA E MOSTRA PODIO
            if (window.sortedFinalRanking.length > 0) { 
                rList.style.display = 'none'; 
                pCont.style.display = 'flex'; 
                void pCont.offsetWidth; 
                pCont.classList.add('visible'); 
                window.podiumState = 1; 
                
                // Opzionale: Ferma la musica iniziale e metti musica tensione se presente
            } else {
                window.page3Active = false;
                window.closeFinalRankingView(); // Torna indietro se non ci sono dati
            }
            return; 
        } 
        
        // FASE 0: RIVELA BLOCCHI DI CLASSIFICA (dal 4° in giù)
        const grp = window.sortedFinalRanking[window.finalRankingIndex]; 
        const row = document.createElement('div'); 
        row.className = 'ranking-row'; 
        const pos = grp.posizione + '°'; 
        
        let nameContent;
        if (grp.nomi.length > 1) { 
            row.classList.add('tied'); 
            nameContent = `<div class="names-group">${grp.nomi.join('<br>')}</div>`;
        } else {
            nameContent = `<span class="name">${grp.nomi[0]}</span>`;
        }
        
        row.innerHTML = `<span class="ranking-pos">${pos}</span>${nameContent}<span class="score">${grp.totale.toFixed(2)}</span>`; 
        
        // Inserisce il nuovo blocco in cima alla lista (push-up effect)
        rList.insertBefore(row, rList.firstChild); 
        
        // Forza reflow e attiva animazione
        void row.offsetWidth; 
        row.classList.add('shown');
        
        // Fa scrollare leggermente verso l'alto
        rList.scrollTo({ top: 0, behavior: 'smooth' });
        
        window.finalRankingIndex++; 
        
    } else { 
        // --- LOGICA RIVELAZIONE PODIO (Posizioni 3, 2, 1) ---
        window.podiumState++; 
        
        switch (window.podiumState) { 
            case 2: // RIVELA 3° CLASSIFICATO (NOME E VOTO)
                if (g3) populatePodiumElement('podiumPos3', g3, true, true); 
                break; 
                
            case 3: // RIVELA 2° e 1° CLASSIFICATO (SOLO VOTO)
                // Usiamo il valore 'true' forzato per il nome e voto perché nel tuo file di esempio era solo 'score'
                if (g2) populatePodiumElement('podiumPos2', g2, false, true); 
                if (g1) populatePodiumElement('podiumPos1', g1, false, true); 
                break; 
                
            case 4: // RIVELA NOMI (2° e 1° CLASSIFICATO) + EFFETTI FINALI
                if (g2) populatePodiumElement('podiumPos2', g2, true, true); // showN=true
                if (g1) populatePodiumElement('podiumPos1', g1, true, true); // showN=true
                
                setTimeout(() => {
                    // Avvia audio vittoria e coriandoli
                    const audio = document.getElementById('vittoriaAudio');
                    if (audio) {
                        audio.currentTime = 0;
                        audio.play().catch(e => console.error("Errore play vittoria:", e));
                    }
                    window.startConfetti(); 
                    
                }, 500); 
                break;
        } 
    } 
};

// Funzione di utilità per popolare un blocco podio (adattata)
function populatePodiumElement(id, grp, showN = true, showS = true) { 
    const el = document.getElementById(id); 
    if (!el || !grp) return; 
    
    // Rimuove la classe per l'animazione di riapparizione
    el.classList.remove('show-name'); 
    
    let nHTML = (grp.nomi.length > 1) 
        ? `<div class="names-group">${grp.nomi.join('<br>')}</div>` 
        : `<span class="name">${grp.nomi[0] || '&nbsp;'}</span>`; 
        
    let sHTML = showS ? `<span class="score">${grp.totale.toFixed(2)}</span>` : `<span class="score">&nbsp;</span>`; 
    
    // Se non è visibile, impostiamo il contenuto iniziale
    if (!el.classList.contains('visible')) {
        el.innerHTML = nHTML + sHTML;
    } else {
        // Altrimenti, aggiorniamo solo i contenuti se necessario
        el.innerHTML = nHTML + sHTML; // Forziamo l'aggiornamento
    }
    
    void el.offsetWidth; // Forza reflow
    
    if (!el.classList.contains('visible')) el.classList.add('visible'); 
    
    // Attiva l'animazione di opacità del nome
    if (showN) setTimeout(() => el.classList.add('show-name'), 100); 
}

// --- FUNZIONI CORIANDOLI (DALL'ESEMPIO) ---

window.startConfetti = function() {
    const confettiContainer = document.getElementById('confettiContainer');
    if (!confettiContainer) return;
    window.stopConfetti(); 
    confettiContainer.style.display = 'block';

    const colors = ['#f093fb', '#f5576c', '#667eea', '#764ba2', '#fffb8f', '#ffffff'];

    const createPiece = () => {
        if (!window.page3Active || window.podiumState <= 3) {
            window.stopConfetti(); 
            return;
        }

        const piece = document.createElement('div');
        piece.classList.add('confetti-piece');
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        const duration = Math.random() * 3 + 4; 
        piece.style.animationDuration = `${duration}s`;
        const size = Math.random() * 8 + 6;
        piece.style.width = `${size}px`;
        piece.style.height = `${size * 1.5}px`;
        piece.style.transform = `rotateZ(${Math.random() * 360}deg)`;

        confettiContainer.appendChild(piece);

        setTimeout(() => {
            piece.remove();
        }, duration * 1000 + 500); 
    };

    window.confettiTimer = setInterval(createPiece, 50);
}

window.stopConfetti = function() {
    const confettiContainer = document.getElementById('confettiContainer');
    if (window.confettiTimer) {
        clearInterval(window.confettiTimer); 
        window.confettiTimer = null;
    }
    if (confettiContainer) {
         setTimeout(() => {
             if (confettiContainer && !window.confettiTimer) { 
                  confettiContainer.innerHTML = ''; 
                  confettiContainer.style.display = 'none'; 
             }
         }, 7000); 
    }
}
