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

// --- VARIABILI DI STATO CLASSIFICA ---
window.finalRankingIndex = 0;
window.sortedFinalRanking = [];
window.podiumState = 0; 
window.page3Active = false; 

// --- FUNZIONI DI UTILITÀ (omesse per brevità, sono invariate) ---

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

        // Il codice HTML/CSS assicura che questo sia BLU con testo BIANCO
        card.innerHTML = `
            <h3>${nome}</h3>
            <div class="partecipante-info">
                <span class="vote-count">${conteggio} voti</span>
                <button class="remove-btn" onclick="event.stopPropagation(); apriModaleConfermaElimina('${nome}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        listaDiv.appendChild(card);
    }
}

// (Omessi per brevità: apriModaleInserimento, salvaNomeDaModale, apriModaleQr, chiudiModale, apriModaleConfermaElimina, rimuoviPartecipante)


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
                currentRank = currentRank + tiedCount + 1;
                lastScore = p.totale;
                tiedCount = 0;
            }
            tiedCount++;
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
        
        window.sortedFinalRanking.reverse();
        
        // 3. Inizia la presentazione dinamica
        window.finalRankingIndex = 0;
        window.podiumState = 0;
        goToFinalRankingView();
        
        document.body.style.cursor = 'default';

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Errore nel calcolo o nel recupero dei dati da Firebase:", error);
        alert(`ERRORE: Impossibile calcolare la media e la classifica.`);
    }
}

// (Omessi per brevità: goToFinalRankingView, closeFinalRankingView, resetCompleto)

window.showNextRankingRow = function() { 
    if (!window.page3Active) return; 
    
    const rListContainer = document.getElementById('ranking-list-container');
    const pCont = document.getElementById('podiumContainer');
    const podiumOverlay = document.getElementById('podiumOverlay');
    const vittoriaAudio = document.getElementById('vittoriaAudio');

    const g1 = window.sortedFinalRanking.find(g => g.posizione === 1);
    const g2 = window.sortedFinalRanking.find(g => g.posizione === 2);
    const g3 = window.sortedFinalRanking.find(g => g.posizione === 3);

    // --- LOGICA DI TRANSIZIONE DALLA LISTA AL PODIO (Posizione 4) ---
    if (window.podiumState === 0) { 
        const threshPosition = 3; 
        
        if (window.finalRankingIndex >= window.sortedFinalRanking.length || 
            (window.sortedFinalRanking[window.finalRankingIndex]?.posizione <= threshPosition)) { 
            
            if (window.sortedFinalRanking.length > 0) { 
                // FASE 1: NASCONDI LISTA E PREPARA IL PODIO
                rListContainer.style.opacity = '0';
                
                setTimeout(() => {
                    rListContainer.style.display = 'none';
                    pCont.style.display = 'block'; 
                    
                    podiumOverlay.classList.add('active'); 
                    
                    void pCont.offsetWidth; 
                    pCont.classList.add('visible'); 
                    pCont.style.opacity = '1';
                    
                    window.podiumState = 1; 
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
        
        const namesCount = grp.nomi.length; 
        row.setAttribute('data-nomi', namesCount); // IMPOSTA ATTRIBUTO PER ALTEZZA DINAMICA
        
        let nameContent;
        if (namesCount > 1) { 
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
                if (g2) populatePodiumElement('podiumPos2', g2, false, true); 
                if (g1) populatePodiumElement('podiumPos1', g1, false, true); 
                break; 
                
            case 4: // RIVELA NOMI (2° e 1° CLASSIFICATO) + EFFETTI FINALI
                if (g2) populatePodiumElement('podiumPos2', g2, true, true); 
                if (g1) populatePodiumElement('podiumPos1', g1, true, true); 
                
                setTimeout(() => {
                    if (vittoriaAudio) {
                        vittoriaAudio.currentTime = 0;
                        vittoriaAudio.play().catch(e => console.error("Errore play vittoria:", e));
                    }
                    window.startConfetti(); 
                    
                }, 500); 
                break;
        } 
    } 
};

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

// (Omessi per brevità: startConfetti, stopConfetti, altre funzioni modali/reset)
