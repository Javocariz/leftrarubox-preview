document.addEventListener('DOMContentLoaded', () => {
    // 1. Validar Sesión Alumno
    if (sessionStorage.getItem('leftraru_role') !== 'alumno') {
        window.location.href = 'index.html';
        return;
    }

    const currentUserEmail = sessionStorage.getItem('leftraru_user');

    // 2. Base de Datos reactiva con Firebase Firestore
    let db = {
        clases: [],
        alumnos: [],
        ejercicios: [],
        suscripciones: [],
        configuracion: { horasLimite: 2 }
    };

    let currentUserIndex = -1;
    let currentUser = null;
    let isInitialLoad = true;

    // Configurar escuchadores en tiempo real
    const setupRealtimeListeners = () => {
        let loadedCollections = { alumnos: false, clases: false, ejercicios: false, suscripciones: false, configuracion: false };

        const checkInitialRender = (collectionName) => {
            loadedCollections[collectionName] = true;
            if (loadedCollections.alumnos && loadedCollections.clases && loadedCollections.ejercicios && loadedCollections.suscripciones && loadedCollections.configuracion) {
                currentUserIndex = db.alumnos.findIndex(a => a.correo && a.correo.trim().toLowerCase() === currentUserEmail.trim().toLowerCase());
                if (currentUserIndex === -1) {
                    window.location.href = 'index.html';
                    return;
                }
                currentUser = db.alumnos[currentUserIndex];
                renderDashboard();
                renderModales();
            }
        };

        dbRef.collection("alumnos").onSnapshot(snap => {
            db.alumnos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            currentUserIndex = db.alumnos.findIndex(a => a.correo && a.correo.trim().toLowerCase() === currentUserEmail.trim().toLowerCase());
            if (currentUserIndex !== -1) {
                currentUser = db.alumnos[currentUserIndex];
                renderDashboard();
                renderModales();
            }
            checkInitialRender("alumnos");
        });

        dbRef.collection("clases").onSnapshot(snap => {
            db.clases = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (currentUserIndex !== -1) {
                renderDashboard();
                renderModales();
            }
            checkInitialRender("clases");
        });

        dbRef.collection("ejercicios").onSnapshot(snap => {
            db.ejercicios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (currentUserIndex !== -1) {
                renderDashboard();
                renderModales();
            }
            checkInitialRender("ejercicios");
        });

        dbRef.collection("suscripciones").onSnapshot(snap => {
            db.suscripciones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (currentUserIndex !== -1) {
                renderDashboard();
                renderModales();
            }
            checkInitialRender("suscripciones");
        });

        dbRef.collection("configuracion").doc("global").onSnapshot(doc => {
            if (doc.exists) {
                db.configuracion = doc.data();
            }
            if (currentUserIndex !== -1) {
                renderDashboard();
                renderModales();
            }
            checkInitialRender("configuracion");
        });
    };

    setupRealtimeListeners();
    const saveDB = () => {}; // Dummy para compatibilidad

    // ==========================================
    // INTERFAZ Y MODALES
    // ==========================================
    document.getElementById('btn-logout').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
    });

    const modalReservar = document.getElementById('modal-reservar');
    const modalHistorial = document.getElementById('modal-historial');
    const modalProfile = document.getElementById('modal-profile');

    const navBtns = document.querySelectorAll('.nav-btn');
    const updateNavActive = (btnId) => {
        navBtns.forEach(btn => btn.classList.remove('active'));
        if(btnId) document.getElementById(btnId).classList.add('active');
    };

    // BOTÓN HOME
    document.getElementById('btn-nav-home').addEventListener('click', () => {
        updateNavActive('btn-nav-home');
        modalReservar.classList.add('hidden');
        modalHistorial.classList.add('hidden');
        modalProfile.classList.add('hidden');
        modalVoucher.classList.add('hidden');
    });

    // BOTÓN RESERVAR (Centro)
    document.getElementById('btn-open-reservar').addEventListener('click', () => { updateNavActive('btn-nav-reservar'); modalReservar.classList.remove('hidden'); });
    document.getElementById('btn-nav-reservar').addEventListener('click', () => { updateNavActive('btn-nav-reservar'); modalReservar.classList.remove('hidden'); });
    document.getElementById('btn-close-reservar').addEventListener('click', () => { modalReservar.classList.add('hidden'); updateNavActive('btn-nav-home'); });

    // BOTÓN HISTORIAL / CALENDARIO
    document.getElementById('btn-historial').addEventListener('click', () => { updateNavActive('btn-nav-historial'); modalHistorial.classList.remove('hidden'); });
    document.getElementById('btn-nav-historial').addEventListener('click', () => { updateNavActive('btn-nav-historial'); modalHistorial.classList.remove('hidden'); });
    document.getElementById('btn-close-historial').addEventListener('click', () => { modalHistorial.classList.add('hidden'); updateNavActive('btn-nav-home'); });

    // BOTÓN NOTIFICACIONES (CABECERA Y BOTTOM PILL)
    const openBellNotification = () => {
        alert("No tienes notificaciones nuevas.");
    };
    
    const btnBellHeader = document.getElementById('btn-bell-notifications');
    if (btnBellHeader) {
        btnBellHeader.addEventListener('click', openBellNotification);
    }
    
    const btnBellPill = document.getElementById('btn-nav-notifications');
    if (btnBellPill) {
        btnBellPill.addEventListener('click', () => {
            updateNavActive('btn-nav-notifications');
            openBellNotification();
        });
    }

    const btnPaymentsPill = document.getElementById('btn-nav-payments');
    if (btnPaymentsPill) {
        btnPaymentsPill.addEventListener('click', () => {
            updateNavActive('btn-nav-payments');
            modalReservar.classList.add('hidden');
            modalHistorial.classList.add('hidden');
            modalProfile.classList.add('hidden');
            openVoucherUpload();
        });
    }

    // BOTÓN PERFIL
    document.getElementById('btn-nav-profile').addEventListener('click', () => {
        updateNavActive('btn-nav-profile');
        renderProfile();
        modalProfile.classList.remove('hidden');
    });
    document.getElementById('btn-close-profile').addEventListener('click', () => { modalProfile.classList.add('hidden'); updateNavActive('btn-nav-home'); });
 
    // BOTÓN LOGOUT EN PANTALLA DE BLOQUEO
    const btnLogoutBlocked = document.getElementById('btn-logout-blocked');
    if (btnLogoutBlocked) {
        btnLogoutBlocked.onclick = () => {
            sessionStorage.clear();
            window.location.href = 'index.html';
        };
    }

    // ==========================================
    // LÓGICA DE DATOS
    // ==========================================
    const renderDashboard = () => {
        currentUser = db.alumnos[currentUserIndex];

        // 1. Avatar y Nombre
        document.getElementById('student-name').innerText = currentUser.nombre;
        const avatarContainer = document.getElementById('student-avatar');
        if (currentUser.foto) {
            avatarContainer.innerHTML = `<img src="${currentUser.foto}" alt="Avatar">`;
        } else {
            avatarContainer.innerHTML = `<i class="fa-solid fa-user"></i>`;
        }

        // 2. Estado de Suscripción (Vencimiento y Créditos)
        const expDate = new Date(currentUser.caducidad);
        const hoy = new Date();
        const diasFaltantes = Math.ceil((expDate - hoy) / (1000 * 60 * 60 * 24));
        
        let percTime = 100;
        if (diasFaltantes < 0) percTime = 0;
        else if (diasFaltantes <= 30) percTime = (diasFaltantes / 30) * 100; // Asumiendo ciclo de 30 días

        // Lógica visual para barra de tiempo
        const timeFill = document.getElementById('time-fill');
        timeFill.style.width = `${percTime}%`;
        timeFill.style.background = diasFaltantes < 5 ? '#ef4444' : '#60a5fa'; // Rojo si faltan <5 días

        document.getElementById('vencimiento-text').innerText = diasFaltantes < 0 
            ? 'Suscripción Vencida' 
            : `Válido hasta ${expDate.toLocaleDateString('es-ES')}`;

        // PANTALLA DE BLOQUEO POR VENCIMIENTO
        const blockScreen = document.getElementById('block-screen-expired');
        const blockExpireDate = document.getElementById('block-expire-date');
        
        if (diasFaltantes < 0) {
            if (blockScreen) {
                blockScreen.classList.remove('hidden');
                if (blockExpireDate) {
                    blockExpireDate.innerText = expDate.toLocaleDateString('es-ES');
                }
                renderBlockVoucherStatus();
            }
        } else {
            if (blockScreen) blockScreen.classList.add('hidden');
        }

        // Créditos
        const creditosBase = 12; // Asumiendo plan base de 12 para mostrar barra visual
        let percCred = (currentUser.creditos / creditosBase) * 100;
        if(percCred > 100) percCred = 100;
        
        const credFill = document.getElementById('credits-fill');
        credFill.style.width = `${percCred}%`;
        credFill.style.background = currentUser.creditos === 0 ? '#ef4444' : '#a3e635'; // Rojo si no hay

        // 3. Clases Restantes (Créditos)
        document.getElementById('big-credits-number').innerText = currentUser.creditos;

        // --- LÓGICA DE PRÓXIMO PLAN (Suscripciones en Espera) ---
        let proximoPlanHtml = '';
        if (currentUser.proximoPlan) {
            if (diasFaltantes < 0) {
                // Auto-Activar plan si ya pasó la fecha de caducidad
                let nuevaFechaInicio = new Date(); // Inicia hoy porque ya expiró el anterior
                const nuevaCaducidad = new Date(nuevaFechaInicio);
                nuevaCaducidad.setDate(nuevaCaducidad.getDate() + (currentUser.proximoPlan.duracion || 30));

                const alumnoRef = dbRef.collection("alumnos").doc(currentUser.id);
                alumnoRef.update({
                    caducidad: nuevaCaducidad.toISOString(),
                    creditos: currentUser.proximoPlan.creditos,
                    planId: currentUser.proximoPlan.planId,
                    planNombre: currentUser.proximoPlan.planNombre,
                    proximoPlan: null
                });
                return; // Cortar el render, el onSnapshot llamará de nuevo con los datos actualizados
            } else if (currentUser.creditos === 0) {
                // Si faltan días pero ya no tiene créditos, preguntar si quiere adelantar
                proximoPlanHtml = `
                    <div style="background:#fffbeb; border:1px solid #f59e0b; border-radius:12px; padding:15px; margin-top:20px; text-align:center;">
                        <p style="margin:0 0 10px 0; font-size:13px; color:#d97706;"><strong>Te has quedado sin clases</strong> pero tienes el <strong>${currentUser.proximoPlan.planNombre}</strong> en espera.</p>
                        <button onclick="adelantarPlan()" class="btn-primary btn-sm" style="background:#f59e0b; color:white; width:100%; margin:0;">
                            <i class="fa-solid fa-bolt"></i> Adelantar Suscripción Ahora
                        </button>
                    </div>
                `;
            } else {
                // Plan en espera normal
                proximoPlanHtml = `
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:12px; margin-top:20px; text-align:center;">
                        <p style="margin:0; font-size:12px; color:#166534;"><strong>Suscripción Renovada</strong><br>Tu próximo período (${currentUser.proximoPlan.planNombre}) tiene ${currentUser.proximoPlan.creditos} clases listas.</p>
                    </div>
                `;
            }
        }
        
        // Agregar contenedor dinámico en statsSection si no existe o actualizarlo
        let nextPlanContainer = document.getElementById('next-plan-container');
        if(!nextPlanContainer) {
            nextPlanContainer = document.createElement('div');
            nextPlanContainer.id = 'next-plan-container';
            const parentCard = document.querySelector('.global-index-card') || document.querySelector('.dashboard-card');
            if (parentCard) {
                parentCard.appendChild(nextPlanContainer);
            }
        }
        nextPlanContainer.innerHTML = proximoPlanHtml;

        window.adelantarPlan = () => {
            if(confirm('¿Estás seguro que deseas activar tu suscripción en espera AHORA? Tu nueva fecha de caducidad se calculará a partir de hoy y perderás los días restantes del período antiguo.')) {
                let nuevaFechaInicio = new Date();
                const nuevaCaducidad = new Date(nuevaFechaInicio);
                nuevaCaducidad.setDate(nuevaCaducidad.getDate() + (currentUser.proximoPlan.duracion || 30));

                const alumnoRef = dbRef.collection("alumnos").doc(currentUser.id);
                alumnoRef.update({
                    caducidad: nuevaCaducidad.toISOString(),
                    creditos: currentUser.proximoPlan.creditos,
                    planId: currentUser.proximoPlan.planId,
                    planNombre: currentUser.proximoPlan.planNombre,
                    proximoPlan: null
                }).then(() => {
                    alert('¡Suscripción actualizada exitosamente!');
                }).catch(err => alert('Error al actualizar: ' + err));
            }
        };
        const statsSection = document.getElementById('main-stats-section');
        let misClasesPasadas = db.clases.filter(c => c.alumnosInscritos && c.alumnosInscritos.includes(currentUserEmail) && new Date(c.fecha + 'T' + c.hora) < hoy);
        
        const totalClases = misClasesPasadas.length;

        const muscleCounts = {
            'Pecho': 0, 'Espalda': 0, 'Piernas': 0, 
            'Brazos': 0, 'Hombros': 0, 'Core/Abdomen': 0, 
            'Glúteos': 0, 'Cardio': 0
        };

        misClasesPasadas.forEach(c => {
            if(c.ejercicios && c.ejercicios.length > 0) {
                c.ejercicios.forEach(ej => {
                    const ejObj = db.ejercicios.find(e => e.nombre === ej.nombre);
                    if(ejObj && ejObj.musculo && muscleCounts[ejObj.musculo] !== undefined) {
                        muscleCounts[ejObj.musculo]++;
                    }
                });
            } else {
                muscleCounts['Cardio']++;
            }
        });

        const labels = Object.keys(muscleCounts);
        const dataValues = Object.values(muscleCounts);
        const maxVal = Math.max(...dataValues, 5);

        let alertBannerHtml = '';
        const bellBtnHeader = document.getElementById('btn-bell-notifications');
        const bellBtnPill = document.getElementById('btn-nav-notifications');

        if (diasFaltantes < 0) {
            alertBannerHtml = `
                <div class="data-card glassmorphism" style="background:rgba(239, 68, 68, 0.15); border:1px solid #ef4444; border-radius:20px; padding:15px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; gap:15px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.1); width:100%; box-sizing:border-box;">
                    <div style="display:flex; gap:12px; align-items:center; text-align:left;">
                        <i class="fa-solid fa-triangle-exclamation" style="color:#ef4444; font-size:22px; flex-shrink:0;"></i>
                        <div>
                            <h4 style="margin:0 0 2px 0; font-size:14px; font-weight:800; color:white;">Tu plan ha caducado</h4>
                            <p style="margin:0; font-size:11px; color:rgba(255,255,255,0.85);">Sube tu comprobante de transferencia para renovar tu acceso.</p>
                        </div>
                    </div>
                    <button onclick="openVoucherUpload()" style="margin:0; background:#ef4444; border:none; color:white; width:auto; padding:8px 16px; font-size:11px; border-radius:10px; font-weight:800; cursor:pointer; flex-shrink:0;">SUBIR</button>
                </div>
            `;
            if (bellBtnHeader) bellBtnHeader.style.color = '#ef4444';
            if (bellBtnPill) bellBtnPill.style.color = '#ef4444';
        } else if (diasFaltantes <= 3) {
            alertBannerHtml = `
                <div class="data-card glassmorphism" style="background:rgba(245, 158, 11, 0.15); border:1px solid #f59e0b; border-radius:20px; padding:15px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; gap:15px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.1); width:100%; box-sizing:border-box;">
                    <div style="display:flex; gap:12px; align-items:center; text-align:left;">
                        <i class="fa-solid fa-clock" style="color:#f59e0b; font-size:22px; flex-shrink:0;"></i>
                        <div>
                            <h4 style="margin:0 0 2px 0; font-size:14px; font-weight:800; color:white;">Tu plan vence pronto</h4>
                            <p style="margin:0; font-size:11px; color:rgba(255,255,255,0.85);">Faltan ${diasFaltantes} días. Evita cortes subiendo tu comprobante.</p>
                        </div>
                    </div>
                    <button onclick="openVoucherUpload()" style="margin:0; background:#f59e0b; border:none; color:white; width:auto; padding:8px 16px; font-size:11px; border-radius:10px; font-weight:800; cursor:pointer; flex-shrink:0;">SUBIR</button>
                </div>
            `;
            if (bellBtnHeader) bellBtnHeader.style.color = '#f59e0b';
            if (bellBtnPill) bellBtnPill.style.color = '#f59e0b';
        } else {
            if (bellBtnHeader) bellBtnHeader.style.color = '';
            if (bellBtnPill) bellBtnPill.style.color = '';
        }

        if (currentUser.voucherPendiente) {
            if (bellBtnHeader) bellBtnHeader.style.color = '#60a5fa';
            if (bellBtnPill) bellBtnPill.style.color = '#60a5fa';
        }

        statsSection.innerHTML = `
            ${alertBannerHtml}
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                <div class="data-card glassmorphism" style="text-align:center; padding:20px 10px; display:flex; flex-direction:column; justify-content:center; margin-bottom:0;">
                    <div style="font-size:24px; margin-bottom:5px; color:#a3e635;"><i class="fa-solid fa-dumbbell"></i></div>
                    <h3 style="font-size:24px; margin:0 0 5px 0; font-weight:900;">${totalClases}</h3>
                    <p style="font-size:11px; color:var(--text-muted); margin:0; text-transform:uppercase; font-weight:800;">Asistencias</p>
                </div>
                <div class="data-card glassmorphism" style="text-align:center; padding:20px 10px; display:flex; flex-direction:column; justify-content:center; margin-bottom:0;">
                    <div style="font-size:24px; margin-bottom:5px; color:#60a5fa;"><i class="fa-solid fa-ticket"></i></div>
                    <h3 style="font-size:24px; margin:0 0 5px 0; font-weight:900;">${currentUser.creditos || 0}</h3>
                    <p style="font-size:11px; color:var(--text-muted); margin:0; text-transform:uppercase; font-weight:800;">Clases Restantes</p>
                </div>
            </div>

            <div class="data-card glassmorphism" style="padding:20px; text-align:center; background:#0f172a; border-radius:20px; box-shadow:0 10px 25px rgba(0,0,0,0.3); margin-bottom:0;">
                <h3 style="color:white; margin:0 0 15px 0; font-size:16px; font-weight:800;"><i class="fa-solid fa-spider" style="color:#a3e635; margin-right:8px;"></i>Radar del Atleta</h3>
                <div style="position:relative; height:240px; width:100%;">
                    <canvas id="mainRadarChart"></canvas>
                </div>
            </div>
        `;

        setTimeout(() => {
            const canvas = document.getElementById('mainRadarChart');
            if(canvas) {
                if(window.myMainRadar) window.myMainRadar.destroy();
                window.myMainRadar = new Chart(canvas.getContext('2d'), {
                    type: 'radar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Nivel Entrenado',
                            data: dataValues,
                            backgroundColor: 'rgba(163, 230, 53, 0.4)',
                            borderColor: '#a3e635',
                            pointBackgroundColor: '#fff',
                            pointBorderColor: '#a3e635',
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#a3e635',
                            borderWidth: 2,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            r: {
                                angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                pointLabels: {
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    font: { size: 10, family: 'Inter', weight: '600' }
                                },
                                ticks: { display: false, min: 0, max: maxVal, stepSize: 1 }
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                titleFont: { family: 'Inter', size: 13 },
                                bodyFont: { family: 'Inter', size: 12 },
                                padding: 10,
                                cornerRadius: 8,
                                displayColors: false,
                                callbacks: {
                                    label: function(context) { return 'Nivel: ' + context.raw; }
                                }
                            }
                        }
                    }
                });
            }
        }, 100);

        // 4. Panel Inferior (Mis Próximas Clases) - Horizontal Scroll
        const scrollContainer = document.getElementById('next-classes-container');
        scrollContainer.innerHTML = '';

        let misProximas = db.clases.filter(c => {
            return c.alumnosInscritos && c.alumnosInscritos.includes(currentUserEmail) && new Date(c.fecha + 'T' + c.hora) > hoy;
        });

        misProximas.sort((a, b) => new Date(a.fecha + 'T' + a.hora) - new Date(b.fecha + 'T' + b.hora));

        if(misProximas.length === 0) {
            scrollContainer.innerHTML = '<p style="color:var(--text-muted); font-size:12px; margin-left:10px;">Aún no tienes reservas próximas.</p>';
        } else {
            const colors = ['#f97316', '#a3e635', '#3b82f6', '#ec4899']; // Naranja, verde, azul, rosa
            misProximas.forEach((clase, i) => {
                const color = colors[i % colors.length];
                const parts = clase.fecha.split('-');
                const dObj = new Date(parts[0], parts[1]-1, parts[2]);
                const day = dObj.toLocaleDateString('es-ES', { weekday:'short', day:'numeric' });
                const classDate = new Date(clase.fecha + 'T' + clase.hora);
                const limite = db.configuracion.horasLimite || 2;
                const horasFaltantes = (classDate - hoy) / (1000 * 60 * 60);
                const canCancel = horasFaltantes > limite;

                let actionHtml = '';
                if(canCancel) {
                    actionHtml = `
                    <button onclick="cancelClass(${db.clases.indexOf(clase)})" style="width:30px; height:30px; border-radius:50%; background:rgba(0,0,0,0.3); color:white; border:none; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.2);" title="Cancelar Reserva">
                        <i class="fa-solid fa-xmark"></i>
                    </button>`;
                } else {
                    actionHtml = `
                    <div style="width:30px; height:30px; border-radius:50%; background:rgba(0,0,0,0.1); color:rgba(255,255,255,0.6); display:flex; justify-content:center; align-items:center;" title="Fuera de plazo para cancelar">
                        <i class="fa-solid fa-lock"></i>
                    </div>`;
                }
                
                scrollContainer.innerHTML += `
                    <div class="class-card-horizontal" style="background-color: ${color};">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <span style="font-weight:800; font-size:14px;">${clase.hora}</span>
                            ${actionHtml}
                        </div>
                        <h4 style="margin:0 0 5px 0; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${clase.nombre || 'Clase'}</h4>
                        <p style="margin:0; font-size:11px; opacity:0.9;">${day}</p>
                    </div>
                `;
            });
        }
    };

    const renderModales = () => {
        // --- MODAL: RESERVAR ---
        const dispContainer = document.getElementById('clases-disponibles-list');
        dispContainer.innerHTML = '';
        const now = new Date();

        // Obtener fecha de hoy en formato local YYYY-MM-DD para el filtro
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        // Filtro DEFENSIVO: verificar tipo de campo 'fecha' antes de comparar
        // (evita que documentos con campo fecha=undefined sean excluidos silenciosamente)
        let futuras = db.clases.filter(c => {
            if (!c || typeof c.fecha !== 'string' || c.fecha.trim() === '') return false;
            return c.fecha >= todayStr;
        });

        // Ordenar cronológicamente con ID como desempate para garantizar orden determinista
        futuras.sort((a, b) => {
            const dateA = new Date((a.fecha || '') + 'T' + (a.hora || '00:00'));
            const dateB = new Date((b.fecha || '') + 'T' + (b.hora || '00:00'));
            const diff = dateA - dateB;
            if (diff !== 0) return diff;
            return (a.id || '').localeCompare(b.id || '');
        });

        // [DEBUG] Log en consola para diagnosticar clases faltantes
        console.log(`[Leftrarubox] Clases en BD: ${db.clases.length} | Clases a mostrar: ${futuras.length}`);
        futuras.forEach((c, i) => console.log(`  ${i + 1}. "${c.nombre}" | ${c.fecha} ${c.hora} | ID: ${c.id || 'sin-id'}`));

        if (futuras.length === 0) {
            dispContainer.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">No hay clases programadas.</p>';
        } else {
            const agrupadas = {};
            futuras.forEach(clase => {
                const fechaKey = clase.fecha;
                if (!agrupadas[fechaKey]) agrupadas[fechaKey] = [];
                agrupadas[fechaKey].push(clase);
            });

            // Usar manipulación DOM directa en lugar de innerHTML += (que serializa/reparsea el DOM,
            // pudiendo corromper silenciosamente tarjetas ya insertadas y omitir las nuevas)
            Object.keys(agrupadas).sort().forEach(fecha => {
                const parts = fecha.split('-');
                const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                const formatDia = dObj.toLocaleDateString('es-ES', { weekday: 'long' });
                const formatNum = dObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                const formatDiaCap = formatDia.charAt(0).toUpperCase() + formatDia.slice(1);

                // Columna del día creada con DOM directo
                const colDiv = document.createElement('div');
                colDiv.style.cssText = 'min-width: 300px; max-width: 350px; flex-shrink: 0; scroll-snap-align: start;';

                const headerDiv = document.createElement('div');
                headerDiv.style.cssText = 'background:var(--primary-gradient); color:white; padding:10px 15px; border-radius:12px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; box-shadow:var(--shadow-glow);';
                headerDiv.innerHTML = `<h3 style="margin:0; font-size:16px;">${formatDiaCap}</h3><span style="font-size:14px; font-weight:800;">${formatNum}</span>`;
                colDiv.appendChild(headerDiv);

                const cardsContainer = document.createElement('div');
                cardsContainer.style.cssText = 'display:flex; flex-direction:column; gap:15px;';
                colDiv.appendChild(cardsContainer);

                agrupadas[fecha].forEach(clase => {
                    try {
                        const originalIdx = db.clases.indexOf(clase);

                        // DEFENSIVO: alumnosInscritos puede venir como null/undefined desde Firestore SDK compat
                        if (!clase.alumnosInscritos || !Array.isArray(clase.alumnosInscritos)) {
                            clase.alumnosInscritos = [];
                        }
                        const yaInscrito = clase.alumnosInscritos.includes(currentUserEmail);

                        // Validar si la clase ya pasó (hoy pero hora anterior)
                        const [cYear, cMonth, cDay] = clase.fecha.split('-');
                        const [cHour, cMin] = (clase.hora || "00:00").split(':');
                        const classDateTime = new Date(cYear, cMonth - 1, cDay, cHour, cMin);
                        const isPastClass = classDateTime < new Date();

                        let btnHtml = '';
                        if (yaInscrito) {
                            btnHtml = `<button class="btn-primary btn-sm" disabled style="background:#e2e8f0; color:#64748b; width:100%;">Inscrito</button>`;
                        } else if (isPastClass) {
                            btnHtml = `<button class="btn-primary btn-sm" disabled style="background:#e2e8f0; color:#64748b; width:100%;">Clase Finalizada</button>`;
                        } else {
                            btnHtml = `<button class="btn-primary btn-sm" onclick="bookClass(${originalIdx})" style="width:100%; background:#0f172a;">Reservar Clase</button>`;
                        }

                        const ejList = (clase.ejercicios || []).map(e => (e && e.nombre) ? e.nombre : '').filter(Boolean).join(', ') || 'Rutina General';

                        const cardDiv = document.createElement('div');
                        cardDiv.className = 'data-card';
                        cardDiv.style.cssText = 'border:1px solid rgba(0,0,0,0.05); padding:15px; margin-bottom:0;';
                        cardDiv.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                <h3 style="margin:0; font-size:24px; color:var(--text-main); font-weight:900;">${clase.hora || '--:--'}</h3>
                            </div>
                            <h4 style="margin:0 0 5px 0; font-size:14px; color:var(--primary-color); text-transform:capitalize;">${clase.nombre || 'Clase de Entrenamiento'}</h4>
                            <p style="font-size:11px; color:var(--text-muted); margin-bottom:10px; line-height:1.4;"><strong>Ejercicios:</strong> ${ejList}</p>
                            <p style="font-size:12px; color:var(--text-main); margin-bottom:15px; font-weight:600;"><i class="fa-solid fa-user-tie" style="color:var(--text-muted); margin-right:5px;"></i> Prof. ${clase.profesor || 'Sin asignar'}</p>
                            ${btnHtml}
                        `;
                        cardsContainer.appendChild(cardDiv);
                    } catch (err) {
                        console.error('[Leftrarubox] Error al renderizar clase:', clase && clase.nombre, err);
                    }
                });

                dispContainer.appendChild(colDiv);
            });
        }

        // --- MODAL: HISTORIAL ---
        const histContainer = document.getElementById('historial-list');
        histContainer.innerHTML = '';
        histContainer.style.display = 'grid';
        histContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
        histContainer.style.gap = '15px';
        
        let misClases = db.clases.filter(c => {
            if(!c.alumnosInscritos || !c.alumnosInscritos.includes(currentUserEmail)) return false;
            return new Date(c.fecha + 'T' + c.hora) < now;
        });
        misClases.sort((a, b) => new Date(b.fecha + 'T' + b.hora) - new Date(a.fecha + 'T' + a.hora));

        if(misClases.length === 0) {
            histContainer.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">Sin historial de asistencias pasadas.</p>';
        } else {
            misClases.forEach(clase => {
                const parts = clase.fecha.split('-');
                const dObj = new Date(parts[0], parts[1]-1, parts[2]);
                const format = dObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

                histContainer.innerHTML += `
                    <div class="data-card" style="padding:15px; margin-bottom:0; border-left:4px solid var(--success-color);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <div>
                                <span style="font-weight:800; font-size:14px;">${format}</span>
                                <span style="color:var(--text-muted); font-size:12px; margin-left:5px;">${clase.hora}</span>
                            </div>
                            <span style="font-size:12px; color:var(--success-color); font-weight:800;"><i class="fa-solid fa-check-circle"></i> Asistida</span>
                        </div>
                        <h4 style="margin:0; font-size:13px; color:var(--text-main); text-transform:capitalize;">${clase.nombre || 'Clase de Entrenamiento'}</h4>
                    </div>
                `;
            });
        }
    };

    const renderProfile = () => {
        const profileContainer = document.getElementById('profile-content');
        
        let avatarHtml = currentUser.foto 
            ? `<img src="${currentUser.foto}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:4px solid white; box-shadow:0 10px 25px rgba(0,0,0,0.1); margin-bottom:15px;">` 
            : `<div style="width:120px; height:120px; border-radius:50%; background:var(--primary-gradient); display:flex; justify-content:center; align-items:center; color:white; font-size:50px; border:4px solid white; box-shadow:0 10px 25px rgba(0,0,0,0.1); margin-bottom:15px;"><i class="fa-solid fa-user"></i></div>`;

        profileContainer.innerHTML = `
            ${avatarHtml}
            <div style="text-align:center; width:100%; max-width:400px;">
                <h2 style="margin:0 0 5px 0; font-size:26px;">${currentUser.nombre}</h2>
                <p style="color:var(--text-muted); margin:0 0 25px 0; font-size:15px;"><i class="fa-solid fa-envelope" style="margin-right:8px;"></i>${currentUser.correo}</p>
                
                <div style="background:white; border-radius:15px; padding:20px; text-align:left; margin-bottom:25px; border:1px solid rgba(0,0,0,0.05); width:100%; box-sizing:border-box; box-shadow:0 4px 15px rgba(0,0,0,0.02);">
                    <div style="margin-bottom:15px;">
                        <span style="font-size:12px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Teléfono</span><br>
                        <strong style="font-size:16px; color:var(--text-main);">${currentUser.telefono || 'No registrado'}</strong>
                    </div>
                    <div>
                        <span style="font-size:12px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Miembro desde</span><br>
                        <strong style="font-size:16px; color:var(--text-main);">${new Date(currentUser.inscripcion).toLocaleDateString('es-ES', {year:'numeric', month:'long', day:'numeric'})}</strong>
                    </div>
                </div>

                <button class="btn-primary" id="btn-logout-profile" style="width:100%; background:#ef4444; color:white; padding:15px; border-radius:12px; font-size:16px; font-weight:800; box-shadow:0 4px 15px rgba(239, 68, 68, 0.3); border:none;"><i class="fa-solid fa-arrow-right-from-bracket" style="margin-right:10px;"></i> Cerrar Sesión</button>
            </div>
        `;

        document.getElementById('btn-logout-profile').addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = 'index.html';
        });
    };

    window.bookClass = (idx) => {
        const clase = db.clases[idx];
        if (new Date(currentUser.caducidad) < new Date()) {
            alert("Tu suscripción ha caducado."); return;
        }
        
        const [cYear, cMonth, cDay] = clase.fecha.split('-');
        const [cHour, cMin] = (clase.hora || "00:00").split(':');
        const classDateTime = new Date(cYear, cMonth - 1, cDay, cHour, cMin);
        const isPastClass = classDateTime < new Date();
        if (isPastClass) {
            alert("Lo sentimos, esta clase ya ha comenzado o finalizado."); return;
        }
        
        if (currentUser.creditos <= 0) {
            if (currentUser.proximoPlan) {
                alert("Te has quedado sin clases. Tienes un plan en espera. Adelántalo desde la pantalla de inicio.");
            } else {
                alert("No te quedan créditos para reservar.");
            }
            return;
        }

        if (confirm(`¿Reservar clase para el ${clase.fecha} a las ${clase.hora}?`)) {
            const updatedInscritos = clase.alumnosInscritos || [];
            updatedInscritos.push(currentUserEmail);
            
            const alumnoRef = dbRef.collection("alumnos").doc(currentUser.id);
            const claseRef = dbRef.collection("clases").doc(clase.id);
            
            const batch = firebase.firestore().batch();
            batch.update(claseRef, { alumnosInscritos: updatedInscritos });
            batch.update(alumnoRef, { creditos: firebase.firestore.FieldValue.increment(-1) });
            
            batch.commit().then(() => {
                modalReservar.classList.add('hidden');
            }).catch(err => alert("Error al realizar reserva: " + err));
        }
    };

    window.cancelClass = (idx) => {
        const clase = db.clases[idx];
        const [cYear, cMonth, cDay] = clase.fecha.split('-');
        const [cHour, cMin] = (clase.hora || "00:00").split(':');
        const classDateTime = new Date(cYear, cMonth - 1, cDay, cHour, cMin);
        
        if (classDateTime < new Date()) {
            alert("No puedes cancelar una reserva de una clase que ya comenzó o finalizó.");
            return;
        }

        if(confirm('¿Cancelar tu reserva? Se te devolverá el crédito.')) {
            const updatedInscritos = (clase.alumnosInscritos || []).filter(e => e !== currentUserEmail);
            
            const alumnoRef = dbRef.collection("alumnos").doc(currentUser.id);
            const claseRef = dbRef.collection("clases").doc(clase.id);
            
            const batch = firebase.firestore().batch();
            batch.update(claseRef, { alumnosInscritos: updatedInscritos });
            batch.update(alumnoRef, { creditos: firebase.firestore.FieldValue.increment(1) });
            
            batch.commit().catch(err => alert("Error al cancelar reserva: " + err));
        }
    };

    // Lógica de Comprobantes de Pago (Voucher)
    const modalVoucher = document.getElementById('modal-voucher');
    const voucherStatusContent = document.getElementById('voucher-status-content');
    const btnCloseVoucher = document.getElementById('btn-close-voucher');
    
    if (btnCloseVoucher) {
        btnCloseVoucher.onclick = () => {
            modalVoucher.classList.add('hidden');
            updateNavActive('btn-nav-home');
        };
    }

    window.copyToClipboard = (text, btn) => {
        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> ¡Copiado!`;
            btn.style.background = "#22c55e"; // Verde éxito premium
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = "#3b82f6"; // Restaura al azul original
            }, 1500);
        }).catch(err => {
            console.error("Error al copiar al portapapeles: ", err);
            // Fallback robusto para webviews móviles
            const el = document.createElement('textarea');
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> ¡Copiado!`;
            btn.style.background = "#22c55e";
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = "#3b82f6";
            }, 1500);
        });
    };

    window.openVoucherUpload = () => {
        currentUser = db.alumnos[currentUserIndex];
        modalVoucher.classList.remove('hidden');
        renderVoucherStatus();
    };

    const getVoucherHistoryHtml = () => {
        const historial = Array.isArray(currentUser.voucherHistorial)
            ? currentUser.voucherHistorial.filter(item => item.estado === 'aprobado').slice(0, 3)
            : [];
        if (historial.length === 0) {
            return '<p style="font-size:12px; color:#94a3b8; margin:18px 0 0 0;">Aun no tienes vouchers activados registrados.</p>';
        }

        return `
            <div style="width:100%; margin-top:20px; text-align:left;">
                <h4 style="font-size:13px; color:#1e293b; margin:0 0 10px 0; font-weight:900;">Ultimos vouchers activados</h4>
                ${historial.map(item => `
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; gap:12px; align-items:center;">
                        <div>
                            <strong style="display:block; font-size:12px; color:#1e293b;">${item.planNombre || 'Plan'}</strong>
                            <span style="font-size:11px; color:#64748b;">${item.fecha ? new Date(item.fecha).toLocaleDateString('es-ES') : 'Sin fecha'} · ${item.estado || 'pendiente'}</span>
                        </div>
                        ${item.imagen || item.foto ? `<button onclick="window.open('${item.imagen || item.foto}', '_blank')" style="border:none; background:#e0f2fe; color:#0369a1; border-radius:8px; padding:7px 9px; cursor:pointer;"><i class="fa-regular fa-image"></i></button>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    };

    const getPlanOptionsHtml = () => {
        if (!db.suscripciones.length) {
            return '<option value="">No hay planes disponibles</option>';
        }
        return '<option value="">Selecciona el plan que estas pagando</option>' + db.suscripciones.map(plan => {
            return `<option value="${plan.id}">${plan.nombre} - $${Number(plan.valor || 0).toLocaleString('es-CL')}</option>`;
        }).join('');
    };

    const renderVoucherStatus = () => {
        currentUser = db.alumnos[currentUserIndex];
        
        if (currentUser.voucherPendiente) {
            const voucher = currentUser.voucherPendiente;
            voucherStatusContent.innerHTML = `
                <div style="text-align:center; width:100%;">
                    <div style="width:60px; height:60px; border-radius:50%; background:rgba(96,165,250,0.15); color:#60a5fa; display:flex; justify-content:center; align-items:center; font-size:28px; margin:20px auto 15px;">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <h3 style="font-weight:800; font-size:18px; margin:0 0 10px 0; color:#1e293b;">Pago en Revisión</h3>
                    <p style="font-size:13px; color:#475569; margin:0 0 25px 0; line-height:1.5; padding:0 20px;">Ya hemos recibido tu comprobante enviado el <strong>${new Date(currentUser.voucherPendiente.fecha).toLocaleString('es-ES')}</strong>. El administrador validará la información pronto y activará tu cuenta automáticamente.</p>
                    
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:12px; margin:0 0 18px 0; text-align:left;">
                        <p style="margin:0 0 6px 0; font-size:12px; color:#475569;">Plan solicitado: <strong style="color:#1e293b;">${voucher.planNombre || 'Sin plan seleccionado'}</strong></p>
                        <p style="margin:0 0 6px 0; font-size:12px; color:#475569;">Monto: <strong style="color:#1e293b;">$${Number(voucher.monto || 0).toLocaleString('es-CL')}</strong></p>
                        <p style="margin:0; font-size:12px; color:#475569;">El administrador tiene este voucher pendiente de validacion.</p>
                    </div>

                    <div class="voucher-img-container">
                        <img src="${voucher.imagen || voucher.foto}">
                    </div>
                    ${getVoucherHistoryHtml()}
                </div>
            `;
        } else {
            voucherStatusContent.innerHTML = `
                <div style="text-align:center; width:100%;">
                    <div style="width:60px; height:60px; border-radius:50%; background:rgba(245,158,11,0.15); color:#f59e0b; display:flex; justify-content:center; align-items:center; font-size:28px; margin:20px auto 15px;">
                        <i class="fa-solid fa-file-invoice-dollar"></i>
                    </div>
                    <h3 style="font-weight:800; font-size:18px; margin:0 0 10px 0; color:#1e293b;">Datos de Transferencia</h3>
                    <p style="font-size:13px; color:#475569; margin:0 0 20px 0; line-height:1.5; padding:0 20px;">Realiza la transferencia e ingresa tu comprobante para procesar la renovación de tu suscripción.</p>
                    
                    <!-- Imagen de Datos Bancarios Oficial -->
                    <div class="voucher-img-container">
                        <img src="img/transferencia.jpg" alt="Datos de Transferencia">
                    </div>

                    <!-- Caja Bento de Copiado Rápido -->
                    <div class="voucher-card-bento">
                        <h4 style="font-size:11px; color:#475569; text-transform:uppercase; letter-spacing:1px; margin:0 0 12px 0; font-weight:800; text-align:center;"><i class="fa-solid fa-copy" style="margin-right:5px;"></i> Copiar Datos Rápidos</h4>
                        
                        <div class="voucher-copy-item">
                            <div>
                                <p class="voucher-copy-label">RUT</p>
                                <p class="voucher-copy-val">77.437.151-6</p>
                            </div>
                            <button onclick="copyToClipboard('77.437.151-6', this)" style="background:#3b82f6; border:none; color:white; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.2s;"><i class="fa-regular fa-copy"></i> Copiar</button>
                        </div>

                        <div class="voucher-copy-item">
                            <div>
                                <p class="voucher-copy-label">N° CUENTA (VISTA)</p>
                                <p class="voucher-copy-val">02573240513</p>
                            </div>
                            <button onclick="copyToClipboard('02573240513', this)" style="background:#3b82f6; border:none; color:white; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.2s;"><i class="fa-regular fa-copy"></i> Copiar</button>
                        </div>

                        <div class="voucher-copy-item">
                            <div>
                                <p class="voucher-copy-label">CORREO</p>
                                <p class="voucher-copy-val">leftrarubox@gmail.com</p>
                            </div>
                            <button onclick="copyToClipboard('leftrarubox@gmail.com', this)" style="background:#3b82f6; border:none; color:white; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.2s;"><i class="fa-regular fa-copy"></i> Copiar</button>
                        </div>
                    </div>
                    
                    <form id="form-upload-voucher" style="width:100%; box-sizing:border-box; padding:0 5px;">
                        <div class="input-group" style="margin-bottom:15px;">
                            <i class="fa-solid fa-ticket"></i>
                            <select id="voucher-plan-select" required>
                                ${getPlanOptionsHtml()}
                            </select>
                        </div>
                        <div class="voucher-dropzone">
                            <i class="fa-solid fa-cloud-arrow-up"></i>
                            <span id="file-label-text">📥 Haz clic aquí para adjuntar tu voucher</span>
                            <input type="file" id="voucher-file-input" accept="image/*" style="opacity:0; position:absolute; top:0; left:0; width:100%; height:100%; cursor:pointer;" required>
                        </div>
                        
                        <div id="voucher-preview-container" style="display:none; margin:20px 0 10px; max-width:100%; text-align:center;">
                            <p style="font-size:12px; color:#475569; margin-bottom:8px; font-weight:600;">Vista Previa:</p>
                            <img id="voucher-preview-img" style="max-height:150px; max-width:100%; border-radius:8px; border:1px solid #e2e8f0;">
                        </div>
                        
                        <button type="submit" id="btn-submit-voucher" class="btn-primary" style="width:100%; margin-top:20px; border:none; padding:15px; border-radius:12px; font-weight:800; font-size:14px; background:var(--primary-gradient); cursor:pointer; display:flex; justify-content:center; align-items:center; gap:8px; color:white; box-shadow:0 4px 15px rgba(59, 130, 246, 0.3);">
                            <i class="fa-solid fa-paper-plane"></i> Enviar a Revisión
                        </button>
                    </form>
                    ${getVoucherHistoryHtml()}
                </div>
            `;
            
            const fileInput = document.getElementById('voucher-file-input');
            const previewContainer = document.getElementById('voucher-preview-container');
            const previewImg = document.getElementById('voucher-preview-img');
            const fileLabelText = document.getElementById('file-label-text');
            
            if (fileInput) {
                fileInput.addEventListener('change', () => {
                    const file = fileInput.files[0];
                    if (file) {
                        fileLabelText.innerText = file.name;
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            previewImg.src = e.target.result;
                            previewContainer.style.display = 'block';
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
            
            const form = document.getElementById('form-upload-voucher');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    const file = fileInput.files[0];
                    const plan = db.suscripciones.find(item => item.id === document.getElementById('voucher-plan-select').value);
                    if (!file) return;
                    if (!plan) {
                        alert("Selecciona el plan que estas pagando.");
                        return;
                    }
                    
                    const submitBtn = document.getElementById('btn-submit-voucher');
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
                    
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = new Image();
                        img.src = ev.target.result;
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            const MAX_WIDTH = 800;
                            const MAX_HEIGHT = 800;
                            
                            if (width > height) {
                                if (width > MAX_WIDTH) {
                                    height *= MAX_WIDTH / width;
                                    width = MAX_WIDTH;
                                }
                            } else {
                                if (height > MAX_HEIGHT) {
                                    width *= MAX_HEIGHT / height;
                                    height = MAX_HEIGHT;
                                }
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                            
                            dbRef.collection("alumnos").doc(currentUser.id).update({
                                voucherPendiente: {
                                    foto: compressedDataUrl,
                                    imagen: compressedDataUrl,
                                    fecha: new Date().toISOString(),
                                    estado: 'pendiente',
                                    planId: plan.id,
                                    planNombre: plan.nombre,
                                    monto: parseInt(plan.valor || 0),
                                    creditos: parseInt(plan.dias || 0),
                                    duracion: parseInt(plan.duracion || 30)
                                }
                            }).then(() => {
                                alert("¡Comprobante enviado con éxito! Tu pago está en revisión.");
                                renderVoucherStatus();
                            }).catch(err => {
                                alert("Error al subir comprobante: " + err);
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar a Revisión';
                            });
                        };
                    };
                    reader.readAsDataURL(file);
                };
            }
        }
    };

    window.cancelVoucherSubmission = () => {
        if (confirm("¿Seguro que deseas eliminar tu comprobante enviado? Dejará de estar en revisión.")) {
            dbRef.collection("alumnos").doc(currentUser.id).update({
                voucherPendiente: null
            }).then(() => {
                alert("Comprobante eliminado con éxito.");
                renderVoucherStatus();
            }).catch(err => alert("Error al eliminar comprobante: " + err));
        }
    };

    // Funciones de Comprobante en Pantalla de Bloqueo
    const renderBlockVoucherStatus = () => {
        currentUser = db.alumnos[currentUserIndex];
        const blockStatusContainer = document.getElementById('block-voucher-status-container');
        if (!blockStatusContainer) return;
        
        if (currentUser.voucherPendiente) {
            blockStatusContainer.innerHTML = `
                <div style="text-align:center; width:100%; margin-top: 10px;">
                    <div style="width:50px; height:50px; border-radius:50%; background:rgba(96,165,250,0.15); color:#60a5fa; display:flex; justify-content:center; align-items:center; font-size:24px; margin:0 auto 15px;">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <h3 style="font-weight:800; font-size:16px; margin:0 0 8px 0; color:#1e293b;">Pago en Revisión</h3>
                    <p style="font-size:12px; color:#475569; margin:0 0 15px 0; line-height:1.4;">Comprobante enviado el <strong>${new Date(currentUser.voucherPendiente.fecha).toLocaleString('es-ES')}</strong>. El administrador validará el pago pronto y reactivará tu cuenta.</p>
                    
                    <button onclick="cancelBlockVoucherSubmission()" class="btn-primary" style="background:#ef4444; width:100%; border:none; padding:10px; border-radius:10px; font-weight:800; font-size:13px; cursor:pointer; color:white; box-shadow:0 4px 12px rgba(239, 68, 68, 0.2);"><i class="fa-solid fa-trash-can" style="margin-right:6px;"></i> Cancelar y Subir Otro</button>
                </div>
            `;
        } else {
            blockStatusContainer.innerHTML = `
                <div style="text-align:center; width:100%; margin-top: 10px;">
                    <!-- Imagen de Datos Bancarios Oficial -->
                    <div class="voucher-img-container" style="max-height:180px; margin-bottom:12px; padding:6px;">
                        <img src="img/transferencia.jpg" style="max-height:165px;" alt="Datos de Transferencia">
                    </div>

                    <!-- Caja Bento de Copiado Rápido -->
                    <div class="voucher-card-bento" style="padding:12px; margin:0 0 15px 0;">
                        <h4 style="font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:0.8px; margin:0 0 10px 0; font-weight:800; text-align:center;"><i class="fa-solid fa-copy" style="margin-right:4px;"></i> Copiar Datos Rápidos</h4>
                        
                        <div class="voucher-copy-item" style="padding:6px 10px; margin-bottom:6px;">
                            <div>
                                <p class="voucher-copy-label">RUT</p>
                                <p class="voucher-copy-val" style="font-size:11px;">77.437.151-6</p>
                            </div>
                            <button onclick="copyToClipboard('77.437.151-6', this)" style="background:#3b82f6; border:none; color:white; padding:4px 10px; border-radius:5px; font-size:10px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all 0.2s;"><i class="fa-regular fa-copy"></i> Copiar</button>
                        </div>

                        <div class="voucher-copy-item" style="padding:6px 10px; margin-bottom:6px;">
                            <div>
                                <p class="voucher-copy-label">N° CUENTA</p>
                                <p class="voucher-copy-val" style="font-size:11px;">02573240513</p>
                            </div>
                            <button onclick="copyToClipboard('02573240513', this)" style="background:#3b82f6; border:none; color:white; padding:4px 10px; border-radius:5px; font-size:10px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all 0.2s;"><i class="fa-regular fa-copy"></i> Copiar</button>
                        </div>

                        <div class="voucher-copy-item" style="padding:6px 10px;">
                            <div>
                                <p class="voucher-copy-label">CORREO</p>
                                <p class="voucher-copy-val" style="font-size:10px;">leftrarubox@gmail.com</p>
                            </div>
                            <button onclick="copyToClipboard('leftrarubox@gmail.com', this)" style="background:#3b82f6; border:none; color:white; padding:4px 10px; border-radius:5px; font-size:10px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all 0.2s;"><i class="fa-regular fa-copy"></i> Copiar</button>
                        </div>
                    </div>

                    <form id="form-upload-voucher-blocked" style="width:100%;">
                        <div class="input-group" style="margin-bottom:12px;">
                            <i class="fa-solid fa-ticket"></i>
                            <select id="block-voucher-plan-select" required>
                                ${getPlanOptionsHtml()}
                            </select>
                        </div>
                        <div class="voucher-dropzone" style="padding:15px; gap:8px; border-radius:12px; margin-bottom:15px;">
                            <i class="fa-solid fa-cloud-arrow-up" style="font-size:24px;"></i>
                            <span id="block-file-label-text" style="font-size:12px;">📥 Haz clic aquí para adjuntar tu voucher</span>
                            <input type="file" id="block-voucher-file-input" accept="image/*" style="opacity:0; position:absolute; top:0; left:0; width:100%; height:100%; cursor:pointer;" required>
                        </div>
                        
                        <div id="block-voucher-preview-container" style="display:none; margin:10px 0; max-width:100%; text-align:center;">
                            <img id="block-voucher-preview-img" style="max-height:100px; max-width:100%; border-radius:6px; border:1px solid #e2e8f0;">
                        </div>
                        
                        <button type="submit" id="btn-submit-voucher-blocked" class="btn-primary" style="width:100%; border:none; padding:12px; border-radius:10px; font-weight:800; font-size:13px; background:var(--primary-gradient); cursor:pointer; display:flex; justify-content:center; align-items:center; gap:6px; color:white; box-shadow:0 4px 12px rgba(59, 130, 246, 0.3);">
                            <i class="fa-solid fa-paper-plane"></i> Enviar Comprobante
                        </button>
                    </form>
                </div>
            `;
            
            const fileInput = document.getElementById('block-voucher-file-input');
            const previewContainer = document.getElementById('block-voucher-preview-container');
            const previewImg = document.getElementById('block-voucher-preview-img');
            const fileLabelText = document.getElementById('block-file-label-text');
            
            if (fileInput) {
                fileInput.addEventListener('change', () => {
                    const file = fileInput.files[0];
                    if (file) {
                        fileLabelText.innerText = file.name;
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            previewImg.src = e.target.result;
                            previewContainer.style.display = 'block';
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
            
            const form = document.getElementById('form-upload-voucher-blocked');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    const file = fileInput.files[0];
                    const plan = db.suscripciones.find(item => item.id === document.getElementById('block-voucher-plan-select').value);
                    if (!file) return;
                    if (!plan) {
                        alert("Selecciona el plan que estas pagando.");
                        return;
                    }
                    
                    const submitBtn = document.getElementById('btn-submit-voucher-blocked');
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
                    
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = new Image();
                        img.src = ev.target.result;
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            const MAX_WIDTH = 800;
                            const MAX_HEIGHT = 800;
                            
                            if (width > height) {
                                if (width > MAX_WIDTH) {
                                    height *= MAX_WIDTH / width;
                                    width = MAX_WIDTH;
                                }
                            } else {
                                if (height > MAX_HEIGHT) {
                                    width *= MAX_HEIGHT / height;
                                    height = MAX_HEIGHT;
                                }
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                            
                            dbRef.collection("alumnos").doc(currentUser.id).update({
                                voucherPendiente: {
                                    foto: compressedDataUrl,
                                    imagen: compressedDataUrl,
                                    fecha: new Date().toISOString(),
                                    estado: 'pendiente',
                                    planId: plan.id,
                                    planNombre: plan.nombre,
                                    monto: parseInt(plan.valor || 0),
                                    creditos: parseInt(plan.dias || 0),
                                    duracion: parseInt(plan.duracion || 30)
                                }
                            }).then(() => {
                                alert("¡Comprobante enviado con éxito! Tu pago está en revisión y el acceso se reactivará al ser aprobado.");
                                renderBlockVoucherStatus();
                            }).catch(err => {
                                alert("Error al subir comprobante: " + err);
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Comprobante';
                            });
                        };
                    };
                    reader.readAsDataURL(file);
                };
            }
        }
    };

    window.cancelBlockVoucherSubmission = () => {
        if (confirm("¿Seguro que deseas eliminar tu comprobante enviado?")) {
            dbRef.collection("alumnos").doc(currentUser.id).update({
                voucherPendiente: null
            }).then(() => {
                alert("Comprobante eliminado.");
                renderBlockVoucherStatus();
            }).catch(err => alert("Error al eliminar comprobante: " + err));
        }
    };

    console.log("Portal Alumno inicializado con Firebase Firestore en tiempo real.");
});
