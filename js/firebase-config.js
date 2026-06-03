// Configuración de tu aplicación web de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCVB__vtZG-GGNlbYKuBeC0o5dWgF4eRTE",
  authDomain: "leftrarubox-d9d98.firebaseapp.com",
  projectId: "leftrarubox-d9d98",
  storageBucket: "leftrarubox-d9d98.firebasestorage.app",
  messagingSenderId: "151942922026",
  appId: "1:151942922026:web:77a60e76be05be444aa853",
  measurementId: "G-0RQE5L3CVX"
};

// Inicializar Firebase globalmente
firebase.initializeApp(firebaseConfig);
const dbRef = firebase.firestore();
