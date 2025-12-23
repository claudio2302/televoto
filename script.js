/*
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

// --- VARIABILI DI STATO CLASSIFICA (INTEGRATE) ---
window.finalRankingIndex = 0;
window.sortedFinalRanking = [];
// 0=Lista; 1=Transizione Podio (Immagine); 2=Rivelazione 3°; 3=Rivelazione 1°/2° Voto; 4=Rivelazione Nomi + Effetti
window.podiumState = 0; 
window.page3Active = false; 

// Variabile per il timer dei coriandoli (necessario per l'interruzione)
window.confettiTimer = null; 

// --- FUNZIONI DI UTILITÀ (omesse per brevità) ---

function capitalizeWords(str) {
    if (!str) return str;
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

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

// ... (Funzioni di gestione base, omessa per brevità) ...

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

    new QRious({
        element: qrCanvas,
        value: urlVoto,
        size: 300,
        padding: 10
    });

    modal.style.display = 'flex';
}

function chiudiModale(event, id) {
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


// --- FUNZIONI DI CALCOLO E CLASSIFICA (UTILIZZA FIREBASE) ---

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
            const voto = parseFloat(data.voto); 
            
            if (votiRaw.hasOwnProperty(nome) && !isNaN(voto)) {
                votiRaw[nome].push(voto);
            }
        });
        
        let pScores = []; 
        for (const nome in votiRaw) {
            const voti = votiRaw[nome];
            const totaleVoti = voti.length;
            
            let media = 0;
            if (totaleVoti > 0) {
                const somma = voti.reduce((acc, voto) => acc + voto, 0);
                media = parseFloat((somma / totaleVoti).toFixed(2));
            }
            
            pScores.push({ nome: nome, totale: media });
            risultatiMedia[nome] = media;
        }
        
        pScores.sort((a, b) => b.totale - a.totale);

        // 1. Raggruppa i partecipanti per parimerito e assegna la posizione
        let finalParticipantScores = [];
        let currentRank = 0;
        let lastScore = -Infinity;
        let tiedCount = 0;
        pScores.forEach((p) => {
            if (p.totale !== lastScore) {
                currentRank += (tiedCount + 1);
                lastScore = p.totale;
                tiedCount = 0;
            }
            finalParticipantScores.push({ ...p, posizione: currentRank });
        });
        
        // 2. Crea l'array per la rivelazione graduale (gruppi di parimerito)
        window.sortedFinalRanking = []; 
        let currentGroup = [];
        let currentScore = -Infinity;
        let currentPosition = 0;

        finalParticipantScores.forEach(p => {
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
        if (currentGroup.length > 0) {
            window.sortedFinalRanking.push({
                nomi: currentGroup.map(item => item.nome),
                totale: currentScore,
                posizione: currentPosition
            });
        }
        
        // Rivelazione graduale: la classifica inizia dal fondo (posizioni più basse)
        window.sortedFinalRanking.reverse();
        
        // 3. Inizia la presentazione dinamica
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
    
    const rListContainer = document.getElementById('ranking-list-container');

    rListContainer.innerHTML = '';
    rListContainer.style.opacity = '1';
    rListContainer.style.display = 'flex'; // Riabilita la lista per l'animazione iniziale
    
    document.getElementById('podiumContainer').style.display = 'none';
    document.getElementById('podiumContainer').classList.remove('visible'); 
    
    window.page3Active = true;
    
    // Assicura che i contenitori podio siano puliti prima di iniziare
    document.getElementById('podiumPos1').innerHTML = '';
    document.getElementById('podiumPos2').innerHTML = '';
    document.getElementById('podiumPos3').innerHTML = '';
    document.getElementById('podiumPos1').classList.remove('visible', 'show-name');
    document.getElementById('podiumPos2').classList.remove('visible', 'show-name');
    document.getElementById('podiumPos3').classList.remove('visible', 'show-name');
    
    // Pulizia dell'overlay e dei coriandoli
    document.getElementById('podiumOverlay').classList.remove('active');
    window.stopConfetti(); 
}

// Chiude la classifica e torna alla vista principale
window.closeFinalRankingView = function() {
    document.getElementById('classifica-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'block';
    document.getElementById('classificaBtn').style.display = 'block';
    window.page3Active = false;
    window.finalRankingIndex = 0;
    window.podiumState = 0;
    
    caricaConteggiVoti(); 
};

// Funzione che gestisce l'animazione graduale (CORE DELLA TUA RICHIESTA)
window.showNextRankingRow = function() { 
    if (!window.page3Active) return; 
    
    const rListContainer = document.getElementById('ranking-list-container');
    const pCont = document.getElementById('podiumContainer');
    const podiumOverlay = document.getElementById('podiumOverlay');
    const vittoriaAudio = document.getElementById('vittoriaAudio');

    const g1 = window.sortedFinalRanking.find(g => g.posizione === 1);
    const g2 = window.sortedFinalRanking.find(g => g.posizione === 2);
    const g3 = window.sortedFinalRanking.find(g => g.posizione === 3);

    // --- LOGICA DI TRANSIZIONE DALLA LISTA AL PODIO (Stato 0: Rivelazione Blocchi) ---
    if (window.podiumState === 0) { 
        const threshPosition = 3; 
        
        // Se l'indice corrente è fuori dall'array O siamo arrivati al 4° classificato
        if (window.finalRankingIndex >= window.sortedFinalRanking.length || 
            (window.sortedFinalRanking[window.finalRankingIndex]?.posizione <= threshPosition)) { 
            
            if (window.sortedFinalRanking.length > 0) { 
                // FASE 1: NASCONDI LISTA E PREPARA IL PODIO
                rListContainer.style.opacity = '0'; // Dissolvenza della lista
                
                setTimeout(() => {
                    rListContainer.style.display = 'none';
                    pCont.style.display = 'flex'; 
                    podiumOverlay.classList.add('active'); // Dissolvenza per lo sfondo scuro
                    
                    void pCont.offsetWidth; 
                    pCont.classList.add('visible'); 
                    pCont.style.opacity = '1';
                    
                    window.podiumState = 1; // Passa allo stato di transizione
                }, 500); 
            } else {
                window.closeFinalRankingView();
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
        
        rListContainer.insertBefore(row, rListContainer.firstChild); 
        
        void row.offsetWidth; 
        row.classList.add('shown');
        
        if (rListContainer.children.length > 5) {
             rListContainer.scrollTop = 0;
        }

        window.finalRankingIndex++; 
        
    } else { 
        // --- LOGICA RIVELAZIONE PODIO (Stato > 0) ---
        window.podiumState++; 
        
        switch (window.podiumState) { 
            case 2: // RIVELA 3° CLASSIFICATO (NOME E VOTO)
                if (g3) populatePodiumElement('podiumPos3', g3, true, true); 
                break; 
                
            case 3: // RIVELA 2° e 1° CLASSIFICATO (SOLO VOTO)
                // RIVELAZIONE SOLO VOTO
                if (g2) populatePodiumElement('podiumPos2', g2, false, true); 
                if (g1) populatePodiumElement('podiumPos1', g1, false, true); 
                break; 
                
            case 4: // RIVELA NOMI (2° e 1° CLASSIFICATO) + EFFETTI FINALI
                // RIVELAZIONE NOMI
                if (g2) populatePodiumElement('podiumPos2', g2, true, true); 
                if (g1) populatePodiumElement('podiumPos1', g1, true, true); 
                
                setTimeout(() => {
                    if (vittoriaAudio) {
                        vittoriaAudio.currentTime = 0;
                        vittoriaAudio.play().catch(e => console.error("Errore play vittoria:", e));
                    }
                    window.startConfetti(); // AVVIA I CORIANDOLI
                    
                }, 500); 
                break;
        } 
    } 
};

// Funzione di utilità per popolare un blocco podio (adattata)
function populatePodiumElement(id, grp, showN = true, showS = true) { 
    const el = document.getElementById(id); 
    if (!el || !grp) return; 
    
    el.classList.remove('show-name'); 
    
    let nHTML = (grp.nomi.length > 1) 
        ? `<div class="names-group">${grp.nomi.join('<br>')}</div>` 
        : `<span class="name">${grp.nomi[0] || '&nbsp;'}</span>`; 
        
    let sHTML = showS ? `<span class="score">${grp.totale.toFixed(2)}</span>` : `<span class="score">&nbsp;</span>`; 
    
    el.innerHTML = nHTML + sHTML;
    
    void el.offsetWidth; 
    
    if (!el.classList.contains('visible')) el.classList.add('visible'); 
    
    if (showN) setTimeout(() => el.classList.add('show-name'), 100); 
}


// --- FUNZIONI CORIANDOLI (REINTEGRATE) ---

window.startConfetti = function() {
    const confettiContainer = document.getElementById('confettiContainer');
    if (!confettiContainer) return;
    window.stopConfetti(); 
    confettiContainer.style.display = 'block';

    const colors = ['#f093fb', '#f5576c', '#667eea', '#764ba2', '#fffb8f', '#ffffff'];

    const createPiece = () => {
        // La condizione di controllo deve essere > 3 per includere la rivelazione nomi (stato 4)
        if (!window.page3Active || window.podiumState < 4) { 
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

    // Aumentato a 50ms per un effetto più denso
    window.confettiTimer = setInterval(createPiece, 50); 
}

window.stopConfetti = function() {
    const confettiContainer = document.getElementById('confettiContainer');
    if (window.confettiTimer) {
        clearInterval(window.confettiTimer); 
        window.confettiTimer = null;
    }
    if (confettiContainer) {
         // Piccolo ritardo per permettere alle particelle in animazione di finire
         setTimeout(() => {
             if (confettiContainer && !window.confettiTimer) { 
                  confettiContainer.innerHTML = ''; 
                  confettiContainer.style.display = 'none'; 
             }
         }, 7000); 
    }
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
        const colRef = window.db.collection(window.VOTI_COLLECTION);
        const snapshot = await colRef.get();
        
        const batch = window.db.batch();
        
        snapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        localStorage.removeItem(STORAGE_KEY_NOMI);
        localStorage.removeItem(STORAGE_KEY_VISITED);
        
        alert("RESET COMPLETATO! Nuova sessione iniziata. I voti su Firebase sono stati cancellati.");
        location.reload(); 

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Errore grave nel reset con Firebase:", error);
        alert(`ERRORE GRAVE DURANTE IL RESET. Voti NON azzerati. Controlla la console.`);
    }
}
*/

// --- VARIABILI GLOBALI ---
let partecipanti = {};
const STORAGE_KEY_NOMI = 'televotoNomiOnline';
const STORAGE_KEY_VISITED = 'televotoVisitedQr'; 
let votiCorrenti = {}; 

// Stato Classifica
window.finalRankingIndex = 0;
window.sortedFinalRanking = [];
window.podiumState = 0; 
window.page3Active = false; 

// Nuove Variabili per Audio YouTube
let ytPlayer;
let canzoniVincitori = {};
const vittoriaAudio = document.getElementById('vittoriaAudio');

// --- 1. CARICAMENTO DATI ---

// Carica canzoni dal file JSON
async function caricaCanzoni() {
    try {
        const response = await fetch('canzoni.json');
        if (response.ok) {
            canzoniVincitori = await response.json();
            console.log("Database canzoni YouTube caricato.");
        }
    } catch (e) {
        console.warn("Nessun file canzoni.json trovato o errore nel caricamento. Userò audio default.");
    }
}
caricaCanzoni();

// Inizializzazione Player YouTube (chiamata automaticamente dall'API)
window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: '',
        playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1 },
        events: {
            'onReady': (event) => { console.log("Player YouTube pronto."); window.ytPlayer = ytPlayer; },
            'onError': (e) => { console.error("Errore Player YouTube:", e); }
        }
    });
};

function capitalizeWords(str) {
    if (!str) return str;
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

function caricaPartecipanti() {
    const raw = localStorage.getItem(STORAGE_KEY_NOMI);
    if (raw) {
        partecipanti = JSON.parse(raw);
        renderPartecipanti();
    }
}

function renderPartecipanti() {
    const container = document.getElementById('listaPartecipanti');
    if (!container) return;
    container.innerHTML = '';

    const visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || "[]");

    Object.keys(partecipanti).sort().forEach(nome => {
        const count = votiCorrenti[nome] ? votiCorrenti[nome].count : 0;
        const avg = votiCorrenti[nome] ? votiCorrenti[nome].avg : "0.00";

        const card = document.createElement('div');
        card.className = 'card' + (visited.includes(nome) ? ' visited' : '');
        card.innerHTML = `
            <div class="card-name">${nome}</div>
            <div class="vote-info">
                <i class="fas fa-star"></i> Media: <strong>${avg}</strong><br>
                <i class="fas fa-vote-yea"></i> Voti: ${count}
            </div>
            <a href="voto.html?n=${encodeURIComponent(nome)}" class="btn-vota" onclick="markAsVisited('${nome}')">VOTA</a>
        `;
        container.appendChild(card);
    });
}

window.markAsVisited = function(nome) {
    const visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || "[]");
    if (!visited.includes(nome)) {
        visited.push(nome);
        localStorage.setItem(STORAGE_KEY_VISITED, JSON.stringify(visited));
    }
}

async function caricaConteggiVoti() {
    if (!window.db) return;
    try {
        const snapshot = await window.db.collection(window.VOTI_COLLECTION).get();
        const conteggi = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const n = data.nome;
            const v = parseFloat(data.voto) || 0;
            if (!conteggi[n]) conteggi[n] = { sum: 0, count: 0 };
            conteggi[n].sum += v;
            conteggi[n].count += 1;
        });
        Object.keys(conteggi).forEach(n => {
            votiCorrenti[n] = {
                count: conteggi[n].count,
                avg: (conteggi[n].sum / conteggi[n].count).toFixed(2)
            };
        });
        renderPartecipanti();
    } catch (e) { console.error("Errore caricamento voti:", e); }
}

// --- 2. LOGICA CLASSIFICA ---

function parseYouTubeUrl(url) {
    if (!url || !url.includes('youtube.com') && !url.includes('youtu.be')) return null;
    try {
        let videoId = '';
        let startSeconds = 0;
        if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split(/[?#]/)[0];
        } else {
            const urlObj = new URL(url);
            videoId = urlObj.searchParams.get('v');
        }
        const urlParams = new URLSearchParams(url.split('?')[1]);
        if (urlParams.has('t')) {
            startSeconds = parseInt(urlParams.get('t')) || 0;
        }
        return videoId ? { videoId, startSeconds } : null;
    } catch (e) { return null; }
}

window.apriClassificaFinale = function() {
    const arr = Object.keys(votiCorrenti).map(nome => ({
        nome: nome,
        avg: parseFloat(votiCorrenti[nome].avg)
    })).sort((a, b) => b.avg - a.avg);

    if (arr.length < 3) {
        alert("Servono almeno 3 partecipanti con voti per il podio.");
        return;
    }

    window.sortedFinalRanking = [];
    let currentRank = 1;
    for (let i = 0; i < arr.length; i++) {
        if (i > 0 && arr[i].avg < arr[i-1].avg) currentRank = i + 1;
        window.sortedFinalRanking.push({
            rank: currentRank,
            nomi: [arr[i].nome],
            avg: arr[i].avg.toFixed(2)
        });
    }

    // Raggruppa parimerito
    const grouped = [];
    window.sortedFinalRanking.forEach(item => {
        const existing = grouped.find(g => g.rank === item.rank);
        if (existing) existing.nomi.push(item.nomi[0]);
        else grouped.push(item);
    });
    window.sortedFinalRanking = grouped;

    document.getElementById('finalRankingOverlay').classList.add('active');
    window.page3Active = true;
    window.podiumState = 1; 
    document.getElementById('rankingTransitionImg').style.display = 'block';
}

window.showNextRankingRow = function() {
    const img = document.getElementById('rankingTransitionImg');
    const g1 = window.sortedFinalRanking.find(g => g.rank === 1);
    const g2 = window.sortedFinalRanking.find(g => g.rank === 2);
    const g3 = window.sortedFinalRanking.find(g => g.rank === 3);

    switch (window.podiumState) {
        case 1: // Nascondi logo, mostra struttura podio
            img.style.display = 'none';
            window.podiumState = 2;
            break;

        case 2: // Rivela 3° Posto
            if (g3) populatePodiumElement('podiumPos3', g3, true, true);
            window.podiumState = 3;
            break;

        case 3: // Rivela 2° Posto
            if (g2) populatePodiumElement('podiumPos2', g2, true, true);
            window.podiumState = 4;
            break;

        case 4: // Rivela Vincitore + Audio/YouTube + Coriandoli
            if (g1) {
                populatePodiumElement('podiumPos1', g1, true, true);
                window.startConfetti();
                
                setTimeout(() => {
                    const nomeVincitore = g1.nomi[0];
                    const linkYt = canzoniVincitori[nomeVincitore];
                    const infoVideo = parseYouTubeUrl(linkYt);

                    if (infoVideo && window.ytPlayer && typeof window.ytPlayer.loadVideoById === 'function') {
                        console.log("Riproduzione da YouTube per " + nomeVincitore);
                        window.ytPlayer.loadVideoById({
                            videoId: infoVideo.videoId,
                            startSeconds: infoVideo.startSeconds
                        });
                        window.ytPlayer.playVideo();
                    } else {
                        console.log("Nessun link YT o errore: riproduzione audio default.");
                        if (vittoriaAudio) {
                            vittoriaAudio.currentTime = 0;
                            vittoriaAudio.play().catch(e => console.log("Errore riproduzione audio:", e));
                        }
                    }
                }, 500);
            }
            window.podiumState = 5; 
            break;
    }
}

function populatePodiumElement(id, group, visible, showN) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.podium-name').textContent = group.nomi.join(' & ');
    el.querySelector('.podium-score').textContent = group.avg;
    if (visible) el.classList.add('visible');
    if (showN) setTimeout(() => el.classList.add('show-name'), 100);
}

window.closeFinalRankingView = function() {
    document.getElementById('finalRankingOverlay').classList.remove('active');
    window.page3Active = false;
    window.podiumState = 0;
    // Reset stili podio
    ['podiumPos1', 'podiumPos2', 'podiumPos3'].forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('visible', 'show-name');
    });
    window.stopConfetti();
}

// --- FUNZIONI CORIANDOLI (VUOTE) ---
window.startConfetti = function() { /* Implementa se hai una libreria */ };
window.stopConfetti = function() { /* Implementa se hai una libreria */ };

// --- RESET COMPLETO ---
async function resetCompleto() {
    if (!window.db) return;
    if (!confirm("ELIMINARE TUTTI I VOTI E I PARTECIPANTI?")) return;
    try {
        const snapshot = await window.db.collection(window.VOTI_COLLECTION).get();
        const batch = window.db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        localStorage.removeItem(STORAGE_KEY_NOMI);
        localStorage.removeItem(STORAGE_KEY_VISITED);
        alert("Reset completato.");
        location.reload();
    } catch (e) { alert("Errore durante il reset."); }
}
