document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('login-error');

    // --- MIGRACIÓN AUTOMÁTICA DE LOCALSTORAGE A FIRESTORE ---
    let localDB = localStorage.getItem('leftrarubox_db');
    if (localDB) {
        try {
            let parsed = JSON.parse(localDB);
            console.log("Detectados datos locales. Iniciando migración a Firestore...", parsed);
            
            const migrarColeccion = async (nombreColeccion, items) => {
                if (items && Array.isArray(items) && items.length > 0) {
                    const snap = await dbRef.collection(nombreColeccion).limit(1).get();
                    if (snap.empty) {
                        for (let item of items) {
                            // Limpiar IDs temporales si existieran
                            delete item.id;
                            await dbRef.collection(nombreColeccion).add(item);
                        }
                        console.log(`Colección '${nombreColeccion}' migrada con éxito.`);
                    }
                }
            };

            const realizarMigracion = async () => {
                await migrarColeccion("profesores", parsed.profesores);
                await migrarColeccion("suscripciones", parsed.suscripciones);
                await migrarColeccion("ejercicios", parsed.ejercicios);
                await migrarColeccion("alumnos", parsed.alumnos);
                await migrarColeccion("ingresos", parsed.ingresos);
                await migrarColeccion("clases", parsed.clases);
                
                if (parsed.configuracion) {
                    const confSnap = await dbRef.collection("configuracion").doc("global").get();
                    if (!confSnap.exists) {
                        await dbRef.collection("configuracion").doc("global").set(parsed.configuracion);
                        console.log("Configuración migrada.");
                    }
                }
                
                localStorage.setItem('leftrarubox_db_migrated', 'true');
                localStorage.removeItem('leftrarubox_db');
                console.log("Migración finalizada exitosamente.");
                window.location.reload();
            };
            
            realizarMigracion().catch(err => console.error("Error en migración: ", err));
        } catch(e) {
            console.error("Error en migración: ", e);
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = usernameInput.value.trim().toLowerCase();
            const pass = passwordInput.value.trim();

            // 1. Accesos de Administradores Autorizados
            const administradores = {
                'eric.cortes.m5@gmail.com': 'Noah.2020',
                'patricia.a.marchant@gmail.com': 'leftrarubox.2026'
            };

            const userLower = user.toLowerCase().trim();

            if (administradores[userLower] && administradores[userLower] === pass) {
                sessionStorage.setItem('leftraru_role', 'admin');
                sessionStorage.setItem('leftraru_user', userLower);
                window.location.href = 'admin_dashboard.html'; 
            } 
            // 2. Acceso de Alumno o Profesor (Firebase Firestore)
            else {
                dbRef.collection("alumnos")
                    .get()
                    .then(querySnapshot => {
                        // Búsqueda insensible a mayúsculas y espacios
                        const alumnoDoc = querySnapshot.docs.find(doc => {
                            const data = doc.data();
                            return data.correo && data.correo.trim().toLowerCase() === user && data.password === pass;
                        });

                        if (alumnoDoc) {
                            const alumno = alumnoDoc.data();
                            sessionStorage.setItem('leftraru_role', 'alumno');
                            sessionStorage.setItem('leftraru_user', alumno.correo);
                            window.location.href = 'student_dashboard.html';
                        } else {
                            // 3. Acceso de Profesor (Firebase Firestore)
                            dbRef.collection("profesores")
                                .get()
                                .then(profSnapshot => {
                                    const profDoc = profSnapshot.docs.find(doc => {
                                        const data = doc.data();
                                        return data.correo && data.correo.trim().toLowerCase() === user && data.password === pass;
                                    });

                                    if (profDoc) {
                                        const prof = profDoc.data();
                                        sessionStorage.setItem('leftraru_role', 'profesor');
                                        sessionStorage.setItem('leftraru_user', prof.correo);
                                        sessionStorage.setItem('leftraru_prof_name', prof.nombre);
                                        window.location.href = 'trainer_dashboard.html';
                                    } else {
                                        mostrarError();
                                    }
                                })
                                .catch(err => {
                                    console.error("Error en login profe: ", err);
                                    mostrarError();
                                });
                        }
                    })
                    .catch(err => {
                        console.error("Error en login: ", err);
                        mostrarError();
                    });
            }
        });
    }

    function mostrarError() {
        if (errorMsg) {
            errorMsg.classList.remove('hidden');
            passwordInput.value = '';
            passwordInput.focus();
            
            setTimeout(() => {
                errorMsg.classList.add('hidden');
            }, 3000);
        }
    }

    // --- CARGAR NÚMERO DE WHATSAPP ---
    const waBtn = document.getElementById('btn-whatsapp-floating');
    const waNavBtn = document.getElementById('btn-whatsapp-nav');
    
    // Asignar un enlace de prueba por defecto al botón del header para que esté activo e interactivo inmediatamente
    if (waNavBtn) {
        waNavBtn.href = "https://wa.me/56912345678";
    }
    
    if (waBtn || waNavBtn) {
        dbRef.collection("configuracion").doc("global").get().then(doc => {
            if (doc.exists) {
                const config = doc.data();
                if (config.whatsapp) {
                    const waLink = `https://wa.me/${config.whatsapp.replace(/\D/g, '')}`;
                    if (waBtn) {
                        waBtn.href = waLink;
                        waBtn.classList.remove('hidden');
                    }
                    if (waNavBtn) {
                        waNavBtn.href = waLink;
                    }
                }
            }
        }).catch(err => console.error("Error cargando WhatsApp: ", err));
    }

    // --- CARGAR PLANES (SERVICIOS) ---
    const planesGrid = document.getElementById('landing-planes-grid');
    if (planesGrid) {
        dbRef.collection("suscripciones").get().then(querySnapshot => {
            if (!querySnapshot.empty) {
                document.getElementById('servicios').classList.remove('hidden');
                let html = '';
                querySnapshot.forEach(doc => {
                    const sub = doc.data();
                    html += `
                        <div class="plan-card">
                            <div class="plan-price">$${Number(sub.valor).toLocaleString('es-CL')}</div>
                            <h3 class="plan-name">${sub.nombre}</h3>
                            <p class="plan-desc">${sub.descripcion || 'Entrenamiento de alta calidad en nuestra comunidad.'}</p>
                            <button class="btn-plan" onclick="document.getElementById('login-modal').classList.remove('hidden')">
                                SUSCRIBIRSE AHORA
                            </button>
                        </div>
                    `;
                });
                planesGrid.innerHTML = html;
            }
        }).catch(err => console.error("Error cargando planes: ", err));
    }
});
