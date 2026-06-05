document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleRegisterBtn = document.getElementById('btn-toggle-register');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('login-error');
    let isRegisterMode = false;

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

    if (toggleRegisterBtn && registerForm && loginForm) {
        toggleRegisterBtn.addEventListener('click', () => {
            isRegisterMode = !isRegisterMode;
            loginForm.classList.toggle('hidden', isRegisterMode);
            registerForm.classList.toggle('hidden', !isRegisterMode);
            toggleRegisterBtn.innerText = isRegisterMode ? 'Ya tengo cuenta' : 'Crear cuenta con invitacion';
            if (errorMsg) errorMsg.classList.add('hidden');
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('reg-nombre').value.trim();
            const telefono = document.getElementById('reg-telefono').value.trim();
            const correo = document.getElementById('reg-correo').value.trim().toLowerCase();
            const password = document.getElementById('reg-password').value.trim();

            if (!nombre || !correo || !password) {
                mostrarError('Completa nombre, correo y clave.');
                return;
            }

            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
                mostrarError('Ingresa un correo valido.');
                return;
            }

            if (password.length < 7 || password.length > 8) {
                mostrarError('La clave debe tener 7 u 8 caracteres.');
                return;
            }

            try {
                const alumnoSnap = await dbRef.collection("alumnos")
                    .where("correo", "==", correo)
                    .limit(1)
                    .get();

                if (!alumnoSnap.empty) {
                    mostrarError('Este correo ya tiene una cuenta.');
                    return;
                }

                const configRef = dbRef.collection("configuracion").doc("global");
                const configSnap = await configRef.get();
                const invitaciones = normalizarInvitaciones(configSnap.exists ? configSnap.data() : {});
                const invitacionIndex = invitaciones.findIndex(inv => inv.correo === correo && inv.usado !== true);

                if (invitacionIndex === -1) {
                    mostrarError('Este correo no esta autorizado por administracion.');
                    return;
                }

                const alumnoRef = dbRef.collection("alumnos").doc();
                const hoy = fechaKey(new Date());

                await dbRef.runTransaction(async (transaction) => {
                    const currentConfig = await transaction.get(configRef);
                    const currentInvitaciones = normalizarInvitaciones(currentConfig.exists ? currentConfig.data() : {});
                    const currentIndex = currentInvitaciones.findIndex(inv => inv.correo === correo && inv.usado !== true);

                    if (currentIndex === -1) {
                        throw new Error('La invitacion ya fue utilizada.');
                    }

                    currentInvitaciones[currentIndex] = {
                        ...currentInvitaciones[currentIndex],
                        correo,
                        usado: true,
                        usadoEn: hoy,
                        alumnoId: alumnoRef.id
                    };

                    transaction.set(alumnoRef, {
                        nombre,
                        telefono,
                        correo,
                        password,
                        foto: null,
                        planNombre: 'Sin plan',
                        creditos: 0,
                        inscripcion: hoy,
                        caducidad: null,
                        invitacionId: invitacionId(correo)
                    });

                    transaction.set(configRef, { invitaciones: currentInvitaciones }, { merge: true });
                });

                sessionStorage.setItem('leftraru_role', 'alumno');
                sessionStorage.setItem('leftraru_user', correo);
                window.location.href = 'student_dashboard.html';
            } catch (err) {
                console.error("Error al crear cuenta: ", err);
                mostrarError(err.message || 'No se pudo crear la cuenta.');
            }
        });
    }

    function mostrarError(mensaje = 'Credenciales incorrectas') {
        if (errorMsg) {
            errorMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${mensaje}`;
            errorMsg.classList.remove('hidden');
            if (!isRegisterMode && passwordInput) {
                passwordInput.value = '';
                passwordInput.focus();
            }
            
            setTimeout(() => {
                errorMsg.classList.add('hidden');
            }, 3000);
        }
    }

    function normalizarInvitaciones(configuracion) {
        const invitaciones = Array.isArray(configuracion.invitaciones) ? configuracion.invitaciones : [];
        return invitaciones
            .filter(inv => inv && inv.correo)
            .map(inv => ({
                correo: String(inv.correo).trim().toLowerCase(),
                usado: inv.usado === true,
                creadoEn: inv.creadoEn || null,
                usadoEn: inv.usadoEn || null,
                alumnoId: inv.alumnoId || null
            }));
    }

    function fechaKey(date) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    }

    function invitacionId(email) {
        return email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
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
