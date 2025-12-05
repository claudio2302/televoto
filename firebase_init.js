// firebase_init.js

// Caricamento delle librerie Firebase v9 compatibili (più stabili)
// Le librerie vengono caricate dai tag <script> in index.html

// Configurazione Firebase: I TUOI DATI INSERITI QUI
const firebaseConfig = {
    apiKey: "AIzaSyA-i-_8qSYx_NTBRkjYho3q0msA67P7P7g",
    authDomain: "televoto.firebaseapp.com",
    projectId: "televoto",
    storageBucket: "televoto.firebasestorage.app",
    messagingSenderId: "310518525910",
    appId: "1:310518525910:web:b52785433524c4619a7e77"
};

// Inizializzazione globale
try {
    const app = firebase.initializeApp(firebaseConfig);
    window.db = app.firestore();
    window.VOTI_COLLECTION = "voti"; 
    console.log("Firebase e Firestore inizializzati correttamente.");

    // Segnala che Firebase è pronto
    window.dispatchEvent(new Event('firebaseReady'));

} catch (e) {
    console.error("ERRORE FATALE: Fallimento nell'inizializzazione di Firebase.", e);
    // Visualizza un messaggio di errore visibile se l'inizializzazione fallisce
    document.body.innerHTML = '<h1>ERRORE CRITICO DI CONFIGURAZIONE! Controlla la console.</h1>';
}