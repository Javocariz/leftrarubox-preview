document.addEventListener('DOMContentLoaded', () => {
    // 1. Proteger ruta: Validar si es admin
    if (sessionStorage.getItem('leftraru_role') !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    // Fecha en el Header
    const dateOpts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('es-ES', dateOpts);
    document.getElementById('current-date').innerText = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    // 2. Base de Datos Reactiva con Firebase Firestore
    let db = {
        profesores: [],
        suscripciones: [],
        ejercicios: [],
        alumnos: [],
        ingresos: [],
        clases: [],
        configuracion: { horasLimite: 2 }
    };

    // Variables de Estado del Balance General
    let balancePeriodo = '6meses';
    let balanceAnio = new Date().getFullYear();
    let balanceMes = new Date().getMonth();

    const updateAniosSelector = () => {
        const selectAnio = document.getElementById('balance-anio');
        if (!selectAnio) return;
        
        const aniosSet = new Set();
        aniosSet.add(new Date().getFullYear());
        
        db.ingresos.forEach(ing => {
            if (ing.fecha) {
                const y = new Date(ing.fecha).getFullYear();
                if (!isNaN(y)) aniosSet.add(y);
            }
        });
        
        const aniosOrdenados = Array.from(aniosSet).sort((a, b) => b - a);
        const selectedVal = selectAnio.value || balanceAnio;
        
        selectAnio.innerHTML = aniosOrdenados.map(y => `<option value="${y}">${y}</option>`).join('');
        selectAnio.value = selectedVal;
        balanceAnio = parseInt(selectAnio.value);
    };

    const initBalanceListeners = () => {
        const selectPeriodo = document.getElementById('balance-periodo');
        const selectAnio = document.getElementById('balance-anio');
        const selectMes = document.getElementById('balance-mes');
        
        if (selectPeriodo && selectAnio && selectMes) {
            selectMes.value = balanceMes;
            
            selectPeriodo.addEventListener('change', (e) => {
                balancePeriodo = e.target.value;
                if (balancePeriodo === 'mes') {
                    selectMes.style.display = 'inline-block';
                } else {
                    selectMes.style.display = 'none';
                }
                renderAdminDashboard();
            });
            
            selectAnio.addEventListener('change', (e) => {
                balanceAnio = parseInt(e.target.value);
                renderAdminDashboard();
            });
            
            selectMes.addEventListener('change', (e) => {
                balanceMes = parseInt(e.target.value);
                renderAdminDashboard();
            });
        }
    };
    
    // Configurar escuchadores en tiempo real de Firebase
    const setupRealtimeListeners = () => {
        dbRef.collection("profesores").onSnapshot(snap => {
            db.profesores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderProfesores();
            renderAdminDashboard();
        });
        dbRef.collection("suscripciones").onSnapshot(snap => {
            db.suscripciones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderSuscripciones();
            renderAdminDashboard();
        });
        dbRef.collection("ejercicios").onSnapshot(snap => {
            db.ejercicios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderEjercicios();
            renderAdminDashboard();
        });
        dbRef.collection("alumnos").onSnapshot(snap => {
            db.alumnos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAlumnos();
            renderAdminDashboard();
        });
        dbRef.collection("ingresos").onSnapshot(snap => {
            db.ingresos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderIngresos();
            renderAdminDashboard();
        });
        dbRef.collection("clases").onSnapshot(snap => {
            db.clases = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderPlanificacion();
            renderAdminDashboard();
        });
        dbRef.collection("configuracion").doc("global").onSnapshot(doc => {
            if (doc.exists) {
                db.configuracion = doc.data();
                const inputHoras = document.getElementById('horas-limite');
                const inputWhatsapp = document.getElementById('config-whatsapp');
                if (inputHoras) inputHoras.value = db.configuracion.horasLimite || 2;
                if (inputWhatsapp) inputWhatsapp.value = db.configuracion.whatsapp || '';
            }
            renderAdminDashboard();
        });
    };
    
    setupRealtimeListeners();
    initBalanceListeners();
    const saveDB = () => {}; // Dummy para compatibilidad

    // 3. Navegación Full-Screen Grid
    const modules = document.querySelectorAll('.module');
    const menuCards = document.querySelectorAll('.menu-card[data-target]');
    const btnsBackMenu = document.querySelectorAll('.btn-back-menu');

    menuCards.forEach(card => {
        card.addEventListener('click', () => {
            const target = card.dataset.target;
            modules.forEach(m => m.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            
            if (target === 'dashboard') {
                renderAdminDashboard();
            }

            window.scrollTo(0, 0);
        });
    });

    btnsBackMenu.forEach(btn => {
        btn.addEventListener('click', () => {
            modules.forEach(m => m.classList.remove('active'));
            document.getElementById('menu-principal').classList.add('active');
            window.scrollTo(0, 0);
        });
    });

    const logout = () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
    };
    document.getElementById('btn-logout-header').addEventListener('click', logout);
    document.getElementById('btn-logout-card').addEventListener('click', logout);

    // 4. Funciones de Modal
    const modal = document.getElementById('generic-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const btnCloseModal = document.getElementById('btn-close-modal');

    const openModal = (title, contentHTML) => {
        modalTitle.innerText = title;
        modalBody.innerHTML = contentHTML;
        modal.classList.remove('hidden');
    };

    btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));

    // ==========================================
    // MÓDULO: DASHBOARD (Análisis)
    // ==========================================
    const renderAdminDashboard = () => {
        // 1. KPIs
        // Ingresos del mes
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let ingresosMes = 0;
        let pagosPendientesMes = 0;
        db.ingresos.forEach(ing => {
            const d = new Date(ing.fecha);
            const estado = ing.estado || 'pagado';
            if(d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                if (estado === 'pagado') {
                    ingresosMes += ing.monto;
                } else if (estado === 'pendiente') {
                    pagosPendientesMes += ing.monto;
                }
            }
        });
        document.getElementById('kpi-ingresos').innerHTML = `
            $${ingresosMes.toLocaleString('es-CL')} 
            <span style="font-size:11px; color:#f59e0b; display:block; margin-top:2px;">(+ $${pagosPendientesMes.toLocaleString('es-CL')} pendientes)</span>
        `;

        // Alumnos Activos
        let activos = 0;
        db.alumnos.forEach(al => {
            if(new Date(al.caducidad) >= now) activos++;
        });
        document.getElementById('kpi-alumnos').innerText = activos;

        // Clases Programadas (Futuras o de hoy)
        let clasesProg = 0;
        db.clases.forEach(c => {
            if(new Date(c.fecha + 'T' + c.hora) >= now) clasesProg++;
        });
        document.getElementById('kpi-clases').innerText = clasesProg;

        // Plan Más Vendido
        let planesVentas = {};
        db.ingresos.forEach(ing => {
            const estado = ing.estado || 'pagado';
            if (estado === 'pagado') {
                if(!planesVentas[ing.suscripcion]) planesVentas[ing.suscripcion] = 0;
                planesVentas[ing.suscripcion]++;
            }
        });
        
        let planTop = 'Ninguno';
        if(Object.keys(planesVentas).length > 0) {
            planTop = Object.keys(planesVentas).reduce((a, b) => planesVentas[a] > planesVentas[b] ? a : b);
        }
        document.getElementById('kpi-plan').innerText = planTop;

        // Stats del Box
        document.getElementById('kpi-profes').innerText = db.profesores.length;
        document.getElementById('kpi-planes').innerText = db.suscripciones.length;
        document.getElementById('kpi-ejs').innerText = db.ejercicios.length;

        // 2. Gráfico Flujo de Ingresos (Filtrado Interactivo del Balance General)
        updateAniosSelector();

        const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        let labelsIngresos = [];
        let dataIngresos = [];
        let recaudadoTotalSeleccion = 0;

        if (balancePeriodo === '6meses') {
            const anioActual = new Date().getFullYear();
            const mesFinal = (balanceAnio === anioActual) ? new Date().getMonth() : 11;
            
            for(let i=5; i>=0; i--) {
                let m = mesFinal - i;
                let y = balanceAnio;
                if (m < 0) {
                    m += 12;
                    y -= 1;
                }
                labelsIngresos.push(`${mesesNombres[m]} ${y.toString().slice(-2)}`);
                
                let sumaMes = 0;
                db.ingresos.forEach(ing => {
                    if (ing.fecha) {
                        let dIng = new Date(ing.fecha);
                        const estado = ing.estado || 'pagado';
                        if(dIng.getMonth() === m && dIng.getFullYear() === y && estado === 'pagado') {
                            sumaMes += ing.monto;
                        }
                    }
                });
                dataIngresos.push(sumaMes);
                recaudadoTotalSeleccion += sumaMes;
            }
        } else if (balancePeriodo === 'anio') {
            for(let m=0; m<12; m++) {
                labelsIngresos.push(mesesNombres[m]);
                
                let sumaMes = 0;
                db.ingresos.forEach(ing => {
                    if (ing.fecha) {
                        let dIng = new Date(ing.fecha);
                        const estado = ing.estado || 'pagado';
                        if(dIng.getMonth() === m && dIng.getFullYear() === balanceAnio && estado === 'pagado') {
                            sumaMes += ing.monto;
                        }
                    }
                });
                dataIngresos.push(sumaMes);
                recaudadoTotalSeleccion += sumaMes;
            }
        } else if (balancePeriodo === 'mes') {
            const diasEnMes = new Date(balanceAnio, balanceMes + 1, 0).getDate();
            for(let d=1; d<=diasEnMes; d++) {
                labelsIngresos.push(`${d}`);
                
                let sumaDia = 0;
                db.ingresos.forEach(ing => {
                    if (ing.fecha) {
                        let dIng = new Date(ing.fecha);
                        const estado = ing.estado || 'pagado';
                        if(dIng.getDate() === d && dIng.getMonth() === balanceMes && dIng.getFullYear() === balanceAnio && estado === 'pagado') {
                            sumaDia += ing.monto;
                        }
                    }
                });
                dataIngresos.push(sumaDia);
                recaudadoTotalSeleccion += sumaDia;
            }
        }

        // Mostrar total recaudado para la selección realizada
        document.getElementById('kpi-total-historico').innerText = '$' + recaudadoTotalSeleccion.toLocaleString('es-CL');

        const ctxIng = document.getElementById('chart-ingresos');
        if(ctxIng) {
            if(window.chartIngresosObj) window.chartIngresosObj.destroy();
            window.chartIngresosObj = new Chart(ctxIng.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labelsIngresos,
                    datasets: [{
                        label: 'Ingresos Mensuales',
                        data: dataIngresos,
                        borderColor: '#678070', // Color verde premium de referencia
                        backgroundColor: 'rgba(103, 128, 112, 0.1)',
                        borderWidth: 4,
                        fill: true,
                        tension: 0.5, // Curvas más pronunciadas como en la imagen
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#678070',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { display: false, beginAtZero: true }, // Ocultar eje Y para limpieza
                        x: { grid: { display: false }, border: { display: false } }
                    }
                }
            });
        }

        // 3. Gráfico Medidor (Mitad Doughnut) - Rentabilidad
        // Contar asistencias totales por nombre de clase
        let clasesCount = {};
        db.clases.forEach(c => {
            const nombre = c.nombre || 'Entrenamiento';
            if(!clasesCount[nombre]) clasesCount[nombre] = 0;
            if(c.alumnosInscritos) clasesCount[nombre] += c.alumnosInscritos.length;
        });

        const sortedClases = Object.entries(clasesCount).sort((a,b) => b[1] - a[1]).slice(0,3);
        const labelsClases = sortedClases.map(i => i[0]);
        const dataClases = sortedClases.map(i => i[1]);

        const ctxClases = document.getElementById('chart-clases');
        if(ctxClases) {
            if(window.chartClasesObj) window.chartClasesObj.destroy();
            window.chartClasesObj = new Chart(ctxClases.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labelsClases.length ? labelsClases : ['Sin Datos', 'Restante'],
                    datasets: [{
                        data: dataClases.length ? dataClases : [0, 1],
                        backgroundColor: ['#678070', '#e2e8f0', '#94a3b8'],
                        borderWidth: 0,
                        circumference: 180, // Medidor media luna
                        rotation: 270 // Empieza desde la izquierda
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%', // Más delgado y limpio
                    plugins: {
                        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font:{family:'Inter', size:11} } }
                    }
                }
            });
        }
    };

    // ==========================================
    // MÓDULO: ALUMNOS
    // ==========================================
    const renderAlumnos = () => {
        const container = document.getElementById('alumnos-list');
        container.innerHTML = '';
        if(db.alumnos.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:14px; width:100%;">No hay alumnos registrados.</p>';
            return;
        }
        db.alumnos.forEach((al, idx) => {
            const expDate = new Date(al.caducidad);
            const today = new Date();

            // Auto-activación pasiva si el admin está viendo un alumno vencido con plan en espera
            if (al.proximoPlan && expDate < today) {
                let nuevaFechaInicio = new Date();
                const nuevaCaducidad = new Date(nuevaFechaInicio);
                nuevaCaducidad.setDate(nuevaCaducidad.getDate() + (al.proximoPlan.duracion || 30));

                dbRef.collection("alumnos").doc(al.id).update({
                    caducidad: nuevaCaducidad.toISOString(),
                    creditos: al.proximoPlan.creditos,
                    planId: al.proximoPlan.planId,
                    planNombre: al.proximoPlan.planNombre,
                    proximoPlan: null
                });
                return; // Cortar el render para este alumno, el onSnapshot recargará todo en milisegundos
            }

            const timeDiff = expDate.getTime() - today.getTime();
            const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            
            let statusBadge = '';
            if (daysRemaining < 0) {
                statusBadge = '<span class="badge" style="background:rgba(251,113,133,0.15); color:var(--danger-color); margin:0;">Vencido</span>';
            } else if (daysRemaining <= 3) {
                statusBadge = `<span class="badge" style="background:rgba(245,158,11,0.15); color:#d97706; margin:0;">Por Vencer (${daysRemaining}d)</span>`;
            } else {
                statusBadge = '<span class="badge" style="margin:0;">Activo</span>';
            }

            let voucherActionHtml = '';
            if (al.voucherPendiente) {
                voucherActionHtml = `
                    <button class="btn-primary btn-sm" onclick="reviewVoucher('${al.id}')" style="width:100%; background:rgba(245,158,11,0.15); color:#d97706; border:1px solid #f59e0b; margin-bottom:15px; font-weight:800; font-size:12px; display:flex; justify-content:center; align-items:center; gap:8px; cursor:pointer;">
                        <i class="fa-solid fa-file-invoice-dollar" style="font-size:14px;"></i> Pago por Aprobar
                    </button>
                `;
            }

            container.innerHTML += `
                <div class="data-card" style="min-width: 280px; flex-grow:1; max-width:400px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                        <div style="display:flex; gap:15px; align-items:center;">
                            <div style="width:45px; height:45px; border-radius:50%; background:var(--primary-gradient); display:flex; justify-content:center; align-items:center; color:white; font-size:18px; flex-shrink:0; box-shadow:var(--shadow-glow); overflow:hidden;">
                                ${al.foto ? `<img src="${al.foto}" style="width:100%; height:100%; object-fit:cover;">` : '<i class="fa-solid fa-user"></i>'}
                            </div>
                            <div>
                                <h4 style="margin-bottom:2px; font-size:16px;">${al.nombre}</h4>
                                <p style="margin-bottom:2px; font-size:12px;">${al.correo}</p>
                                <p style="margin-bottom:0; font-size:12px; color:var(--text-muted);"><i class="fa-solid fa-phone" style="font-size:10px; margin-right:4px;"></i>${al.telefono || 'Sin teléfono'}</p>
                            </div>
                        </div>
                        ${statusBadge}
                    </div>
                    
                    <div style="background:#f8fafc; padding:12px; border-radius:12px; margin-bottom:15px; border:1px solid rgba(0,0,0,0.02);">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
                            <span style="color:var(--text-muted);">Créditos:</span>
                            <strong>${al.creditos} clases</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:13px;">
                            <span style="color:var(--text-muted);">Vencimiento:</span>
                            <strong style="color:${daysRemaining < 0 ? 'var(--danger-color)' : 'var(--text-main)'};">${expDate.toLocaleDateString('es-ES')}</strong>
                        </div>
                    </div>

                    ${al.proximoPlan ? `
                    <div style="background:#f0fdf4; border:1px dashed #22c55e; color:#166534; font-size:11px; padding:8px; border-radius:8px; margin-bottom:15px; text-align:center;">
                        <i class="fa-solid fa-clock-rotate-left"></i> <strong>Renovación en espera:</strong> ${al.proximoPlan.planNombre} (${al.proximoPlan.creditos} cls)
                    </div>
                    ` : ''}

                    ${voucherActionHtml}

                    <div class="card-actions">
                        <button class="btn-icon" onclick="editAlumno(${idx})" title="Modificar"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon delete" onclick="deleteAlumno(${idx})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    };

    // Funciones de comprobantes de alumnos
    window.reviewVoucher = (alumnoId) => {
        const al = db.alumnos.find(a => a.id === alumnoId);
        if (!al || !al.voucherPendiente) return;

        let planOptions = db.suscripciones.map(s => `<option value="${s.id}">${s.nombre} ($${Number(s.valor).toLocaleString('es-CL')})</option>`).join('');

        openModal('Aprobar Comprobante de Pago', `
            <div style="text-align:center;">
                <p style="font-size:13px; color:var(--text-muted); margin-bottom:15px;">Comprobante enviado por <strong>${al.nombre}</strong> el ${new Date(al.voucherPendiente.fecha).toLocaleString('es-ES')}</p>
                
                <div style="max-width:100%; max-height:300px; border-radius:12px; margin-bottom:20px; border:1px solid #e2e8f0; display:flex; justify-content:center; align-items:center; background:#f8fafc; overflow:hidden;">
                    <img src="${al.voucherPendiente.foto}" style="max-width:100%; max-height:300px; object-fit:contain; cursor:zoom-in;" onclick="window.open('${al.voucherPendiente.foto}', '_blank')" title="Click para ver en grande">
                </div>

                <form id="form-aprobar-voucher">
                    <p style="font-size:13px; font-weight:600; text-align:left; margin-bottom:8px; color:var(--text-main);">Registrar Suscripción en Finanzas:</p>
                    <div class="input-group">
                        <i class="fa-solid fa-ticket"></i>
                        <select id="ap-sub" required>
                            <option value="">Selecciona el Plan (Suscripción)</option>
                            ${planOptions}
                        </select>
                    </div>
                    <div class="input-group">
                        <i class="fa-solid fa-bolt"></i>
                        <input type="number" id="ap-creditos" placeholder="Clases a Otorgar (ej. 12)" required>
                    </div>
                    <p id="ap-info-caducidad" style="font-size:11px; color:var(--text-muted); text-align:center; margin-bottom:15px;">* Selecciona un plan para calcular la caducidad.</p>
                    
                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button type="submit" class="btn-primary btn-sm" style="flex:2; background:var(--success-color); margin:0;">
                            <i class="fa-solid fa-check"></i> Aprobar y Activar
                        </button>
                        <button type="button" onclick="rejectVoucher('${al.id}')" class="btn-primary btn-sm" style="flex:1; background:#ef4444; margin:0;">
                            <i class="fa-solid fa-xmark"></i> Rechazar
                        </button>
                    </div>
                </form>
            </div>
        `);

        // Auto-completar al elegir plan en voucher
        document.getElementById('ap-sub').addEventListener('change', (e) => {
            const plan = db.suscripciones.find(s => s.id === e.target.value);
            if (plan) {
                document.getElementById('ap-creditos').value = plan.dias || 0;
                
                let fechaInicio = new Date();
                const actualCaducidad = new Date(al.caducidad);
                if (actualCaducidad > new Date()) {
                    fechaInicio = actualCaducidad; // No perjudicar días restantes
                }
                const caducidad = new Date(fechaInicio);
                caducidad.setDate(caducidad.getDate() + (plan.duracion || 30));
                
                document.getElementById('ap-info-caducidad').innerHTML = `<strong>Válido hasta:</strong> ${caducidad.toLocaleDateString('es-ES')}`;
            }
        });

        document.getElementById('form-aprobar-voucher').onsubmit = (e) => {
            e.preventDefault();
            const planSeleccionado = db.suscripciones.find(s => s.id === document.getElementById('ap-sub').value);
            if (!planSeleccionado) {
                alert("Debes seleccionar un plan.");
                return;
            }
            
            const subNombre = planSeleccionado.nombre;
            const subMonto = planSeleccionado.valor;
            const creditosNuevos = parseInt(document.getElementById('ap-creditos').value);

            const actualCaducidad = new Date(al.caducidad);
            const tienePlanActivo = actualCaducidad >= new Date() && (al.creditos > 0);

            const batch = firebase.firestore().batch();
            const alumnoRef = dbRef.collection("alumnos").doc(al.id);
            const pendingIngreso = db.ingresos.find(i => i.alumnoId === al.id && i.estado === 'pendiente');

            if (tienePlanActivo) {
                if (al.proximoPlan) {
                    alert("El alumno ya tiene un plan en espera. Solo se permite 1 plan en cola.");
                    return;
                }
                
                // Guardar en cola
                batch.update(alumnoRef, {
                    proximoPlan: {
                        planId: planSeleccionado.id,
                        planNombre: planSeleccionado.nombre,
                        creditos: creditosNuevos,
                        duracion: planSeleccionado.duracion || 30
                    },
                    voucherPendiente: null
                });
            } else {
                // Activar Inmediatamente
                let fechaInicio = new Date();
                const nuevaCaducidad = new Date(fechaInicio);
                nuevaCaducidad.setDate(nuevaCaducidad.getDate() + (planSeleccionado.duracion || 30));
                
                batch.update(alumnoRef, {
                    caducidad: nuevaCaducidad.toISOString(),
                    creditos: creditosNuevos,
                    planId: planSeleccionado.id,
                    planNombre: planSeleccionado.nombre,
                    voucherPendiente: null,
                    proximoPlan: null // Limpiar por si acaso
                });
            }

            let ingresoRef;
            if (pendingIngreso) {
                ingresoRef = dbRef.collection("ingresos").doc(pendingIngreso.id);
                batch.update(ingresoRef, {
                    suscripcion: subNombre,
                    monto: subMonto,
                    fecha: new Date().toISOString().split('T')[0],
                    estado: 'pagado'
                });
            } else {
                ingresoRef = dbRef.collection("ingresos").doc();
                batch.set(ingresoRef, {
                    alumnoNombre: al.nombre,
                    alumnoId: al.id,
                    suscripcion: subNombre,
                    monto: subMonto,
                    fecha: new Date().toISOString().split('T')[0],
                    estado: 'pagado'
                });
            }

            batch.commit().then(() => {
                modal.classList.add('hidden');
                if (tienePlanActivo) {
                    alert(`¡Pago aprobado! Como el alumno tiene un plan activo, la suscripción ha quedado EN ESPERA.`);
                } else {
                    alert(`¡Pago aprobado y suscripción activada!`);
                }
            }).catch(err => alert("Error al aprobar pago: " + err));
        };
    };

    window.rejectVoucher = (alumnoId) => {
        if (confirm("¿Seguro que deseas rechazar este comprobante? Se eliminará la solicitud de revisión.")) {
            dbRef.collection("alumnos").doc(alumnoId).update({
                voucherPendiente: null
            }).then(() => {
                modal.classList.add('hidden');
                alert("Comprobante rechazado exitosamente.");
            }).catch(err => alert("Error al rechazar: " + err));
        }
    };

    document.getElementById('btn-add-alumno').addEventListener('click', () => {
        if(db.suscripciones.length === 0) {
            alert("Debes crear al menos un Plan de Suscripción antes de agregar alumnos.");
            return;
        }

        let subsOptions = db.suscripciones.map(s => `<option value="${s.id}">${s.nombre} ($${Number(s.valor).toLocaleString('es-CL')})</option>`).join('');

        openModal('Nuevo Alumno', `
            <form id="form-alumno" autocomplete="off">
                <div class="input-group">
                    <i class="fa-solid fa-user"></i>
                    <input type="text" id="al-nombre" placeholder="Nombre completo" required autocomplete="off">
                </div>
                <div class="input-group" style="padding:10px 15px; display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-camera"></i>
                    <input type="file" id="al-foto" accept="image/*" style="padding:0; border:none; background:transparent; font-size:13px;" title="Foto del Alumno (Opcional)">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-envelope"></i>
                    <!-- Agregamos un input oculto como trampa para el autocompletado del navegador -->
                    <input style="display:none" type="email" name="fakeusernameremembered"/>
                    <input type="text" id="al-correo" placeholder="Correo o Nickname" required autocomplete="off">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-phone"></i>
                    <input type="tel" id="al-tel" placeholder="Teléfono (Opcional)" autocomplete="off">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-lock"></i>
                    <!-- Agregamos un input oculto como trampa para la contraseña -->
                    <input style="display:none" type="password" name="fakepasswordremembered"/>
                    <input type="password" id="al-pass" placeholder="Contraseña de acceso" required autocomplete="new-password">
                </div>
                
                <hr style="border:none; border-top:1px dashed #eee; margin:15px 0;">
                
                <div class="input-group">
                    <i class="fa-solid fa-ticket"></i>
                    <select id="al-plan" required>
                        <option value="">Seleccionar Plan (Obligatorio)</option>
                        ${subsOptions}
                    </select>
                </div>
                
                <div style="display:flex; gap:15px; margin-bottom:10px;">
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-calendar-day" style="z-index:2;"></i>
                        <input type="date" id="al-fecha" required title="Fecha de inscripción">
                    </div>
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-bolt"></i>
                        <input type="number" id="al-creditos" placeholder="Clases (Créditos)" required>
                    </div>
                </div>
                <p id="al-info-caducidad" style="font-size:11px; color:var(--text-muted); text-align:center; margin-bottom:15px;">* Selecciona un plan para calcular la caducidad.</p>
                <button type="submit" class="btn-primary btn-sm" style="width:100%;">Crear Alumno</button>
            </form>
        `);
        // Fecha de hoy por defecto
        document.getElementById('al-fecha').valueAsDate = new Date();
        
        // Auto-completar al elegir plan
        document.getElementById('al-plan').addEventListener('change', (e) => {
            const plan = db.suscripciones.find(s => s.id === e.target.value);
            if (plan) {
                document.getElementById('al-creditos').value = plan.dias || 0;
                
                const fechaIns = new Date(document.getElementById('al-fecha').value);
                const caducidad = new Date(fechaIns);
                caducidad.setDate(caducidad.getDate() + (plan.duracion || 30));
                
                document.getElementById('al-info-caducidad').innerHTML = `<strong>Válido hasta:</strong> ${caducidad.toLocaleDateString('es-ES')}`;
            }
        });
        
        // Actualizar caducidad si cambia la fecha y hay plan seleccionado
        document.getElementById('al-fecha').addEventListener('change', (e) => {
            const planId = document.getElementById('al-plan').value;
            if (planId) {
                const plan = db.suscripciones.find(s => s.id === planId);
                const fechaIns = new Date(e.target.value);
                const caducidad = new Date(fechaIns);
                caducidad.setDate(caducidad.getDate() + (plan.duracion || 30));
                document.getElementById('al-info-caducidad').innerHTML = `<strong>Válido hasta:</strong> ${caducidad.toLocaleDateString('es-ES')}`;
            }
        });

        document.getElementById('form-alumno').onsubmit = (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('al-foto');
            const file = fileInput.files[0];
            
            const planSeleccionado = db.suscripciones.find(s => s.id === document.getElementById('al-plan').value);
            if (!planSeleccionado) {
                alert("Debes seleccionar un plan.");
                return;
            }

            const inscripcion = new Date(document.getElementById('al-fecha').value);
            const caducidad = new Date(inscripcion);
            caducidad.setDate(caducidad.getDate() + (planSeleccionado.duracion || 30));

            const guardarAlumno = (fotoBase64) => {
                const batch = dbRef.batch();
                
                // 1. Guardar Alumno
                const alumnoRef = dbRef.collection('alumnos').doc();
                batch.set(alumnoRef, {
                    nombre: document.getElementById('al-nombre').value,
                    correo: document.getElementById('al-correo').value.trim().toLowerCase(),
                    telefono: document.getElementById('al-tel').value,
                    password: document.getElementById('al-pass').value,
                    inscripcion: inscripcion.toISOString(),
                    caducidad: caducidad.toISOString(),
                    creditos: parseInt(document.getElementById('al-creditos').value),
                    foto: fotoBase64 || null,
                    planId: planSeleccionado.id,
                    planNombre: planSeleccionado.nombre
                });
                
                // 2. Guardar Ingreso Financiero (Pagado)
                const ingresoRef = dbRef.collection('ingresos').doc();
                batch.set(ingresoRef, {
                    alumnoNombre: document.getElementById('al-nombre').value,
                    alumnoId: alumnoRef.id,
                    suscripcion: planSeleccionado.nombre,
                    monto: planSeleccionado.valor,
                    fecha: new Date().toISOString().split('T')[0],
                    estado: 'pagado'
                });

                batch.commit().then(() => {
                    modal.classList.add('hidden');
                }).catch(err => alert("Error al guardar alumno e ingreso: " + err));
            };

            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => guardarAlumno(ev.target.result);
                reader.readAsDataURL(file);
            } else {
                guardarAlumno(null);
            }
        };
    });

    window.deleteAlumno = (idx) => {
        if(confirm('¿Eliminar alumno? Sus datos de acceso se perderán.')) {
            const al = db.alumnos[idx];
            if (al && al.id) {
                dbRef.collection("alumnos").doc(al.id).delete()
                    .catch(err => alert("Error al eliminar: " + err));
            }
        }
    };

    window.editAlumno = (idx) => {
        const al = db.alumnos[idx];
        const fechaIns = new Date(al.inscripcion).toISOString().split('T')[0];
        openModal('Modificar Alumno', `
            <form id="form-alumno-edit" autocomplete="off">
                <div class="input-group">
                    <i class="fa-solid fa-user"></i>
                    <input type="text" id="al-nombre" value="${al.nombre}" required autocomplete="off">
                </div>
                <div class="input-group" style="padding:10px 15px; display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-camera"></i>
                    <input type="file" id="al-foto-edit" accept="image/*" style="padding:0; border:none; background:transparent; font-size:13px;" title="Actualizar Foto (Opcional)">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-envelope"></i>
                    <input style="display:none" type="email" name="fakeusernameremembered"/>
                    <input type="text" id="al-correo" value="${al.correo}" required autocomplete="off">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-phone"></i>
                    <input type="tel" id="al-tel" value="${al.telefono || ''}" placeholder="Teléfono (Opcional)" autocomplete="off">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-lock"></i>
                    <input style="display:none" type="password" name="fakepasswordremembered"/>
                    <input type="text" id="al-pass" value="${al.password}" required autocomplete="new-password">
                </div>
                <div style="display:flex; gap:15px; margin-bottom:10px;">
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-calendar-day" style="z-index:2;"></i>
                        <input type="date" id="al-fecha" value="${fechaIns}" required>
                    </div>
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-bolt"></i>
                        <input type="number" id="al-creditos" value="${al.creditos}" required>
                    </div>
                </div>
                <button type="submit" class="btn-primary btn-sm" style="width:100%;">Guardar Cambios</button>
            </form>
        `);
        document.getElementById('form-alumno-edit').onsubmit = (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('al-foto-edit');
            const file = fileInput.files[0];

            const inscripcion = new Date(document.getElementById('al-fecha').value);
            const caducidad = new Date(inscripcion);
            caducidad.setDate(caducidad.getDate() + 30);

            const actualizarAlumno = (fotoBase64) => {
                dbRef.collection("alumnos").doc(al.id).set({
                    nombre: document.getElementById('al-nombre').value,
                    correo: document.getElementById('al-correo').value.trim().toLowerCase(),
                    telefono: document.getElementById('al-tel').value,
                    password: document.getElementById('al-pass').value,
                    inscripcion: inscripcion.toISOString(),
                    caducidad: caducidad.toISOString(),
                    creditos: parseInt(document.getElementById('al-creditos').value),
                    foto: fotoBase64 || al.foto || null
                }).then(() => {
                    modal.classList.add('hidden');
                }).catch(err => alert("Error al actualizar: " + err));
            };

            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => actualizarAlumno(ev.target.result);
                reader.readAsDataURL(file);
            } else {
                actualizarAlumno(al.foto); // Mantener la foto que ya tenía
            }
        };
    };

    // ==========================================
    // MÓDULO: INGRESOS (FINANZAS)
    // ==========================================
    let ingresosFilter = 'todos'; // 'todos', 'pagados', 'pendientes'
    
    const renderIngresos = () => {
        const container = document.getElementById('ingresos-list');
        container.innerHTML = '';
        
        // Agregar controles de filtro encima del grid
        const filterControls = document.createElement('div');
        filterControls.style.cssText = 'display:flex; gap:10px; margin-bottom:15px; width:100%; grid-column: 1 / -1;';
        filterControls.innerHTML = `
            <button class="btn-primary btn-sm" id="btn-filt-todos" style="flex:1; margin:0; background:${ingresosFilter==='todos'?'#3b82f6':'#f1f5f9'}; color:${ingresosFilter==='todos'?'white':'#475569'};">Todos</button>
            <button class="btn-primary btn-sm" id="btn-filt-pagados" style="flex:1; margin:0; background:${ingresosFilter==='pagados'?'var(--success-color)':'#f1f5f9'}; color:${ingresosFilter==='pagados'?'white':'#475569'};">Pagados</button>
            <button class="btn-primary btn-sm" id="btn-filt-pendientes" style="flex:1; margin:0; background:${ingresosFilter==='pendientes'?'#f59e0b':'#f1f5f9'}; color:${ingresosFilter==='pendientes'?'white':'#475569'};">Pendientes</button>
        `;
        container.appendChild(filterControls);
        
        // Listeners para filtros
        const setFilter = (val) => { ingresosFilter = val; renderIngresos(); };
        filterControls.querySelector('#btn-filt-todos').onclick = () => setFilter('todos');
        filterControls.querySelector('#btn-filt-pagados').onclick = () => setFilter('pagados');
        filterControls.querySelector('#btn-filt-pendientes').onclick = () => setFilter('pendientes');

        let dataToShow = db.ingresos.filter(ing => {
            const estado = ing.estado || 'pagado'; // Compatibilidad antigua
            if (ingresosFilter === 'pagados' && estado !== 'pagado') return false;
            if (ingresosFilter === 'pendientes' && estado !== 'pendiente') return false;
            return true;
        });
        
        // Ordenar más recientes primero
        dataToShow.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

        if(dataToShow.length === 0) {
            container.insertAdjacentHTML('beforeend', '<p style="color:var(--text-muted); font-size:14px; width:100%; text-align:center; padding:20px; grid-column: 1 / -1;">No hay ingresos en esta categoría.</p>');
            return;
        }
        
        dataToShow.forEach((ing) => {
            const originalIdx = db.ingresos.indexOf(ing);
            const fechaFormat = new Date(ing.fecha).toLocaleDateString('es-ES');
            const estado = ing.estado || 'pagado';
            
            let statusBadge = '';
            if (estado === 'pendiente') {
                statusBadge = '<span class="badge" style="background:rgba(245,158,11,0.1); color:#f59e0b; margin:0;"><i class="fa-solid fa-clock"></i> Pendiente</span>';
            } else {
                statusBadge = '<span class="badge" style="background:rgba(34,197,94,0.1); color:var(--success-color); margin:0;"><i class="fa-solid fa-check"></i> Pagado</span>';
            }
            
            container.insertAdjacentHTML('beforeend', `
                <div class="data-card" style="min-width: 260px; border-left: 4px solid ${estado==='pendiente'?'#f59e0b':'var(--success-color)'};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        ${statusBadge}
                        <div style="display:flex; gap:5px;">
                            ${estado==='pagado' ? `<button class="btn-icon" onclick="viewVoucher(${originalIdx})" title="Ver Voucher" style="padding:4px; color:var(--success-color);"><i class="fa-solid fa-file-invoice"></i></button>` : ''}
                            <button class="btn-icon delete" onclick="deleteIngreso(${originalIdx})" title="Eliminar" style="padding:4px;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    <h4 style="margin-top:15px; margin-bottom:5px;">${ing.alumnoNombre}</h4>
                    <p style="font-size:13px; margin-bottom:12px;">Plan: <strong>${ing.suscripcion}</strong></p>
                    <div style="font-size:24px; font-weight:800; color:var(--text-main); margin-bottom:5px;">
                        $ ${Number(ing.monto).toLocaleString('es-CL')}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); text-align:right;">${fechaFormat}</div>
                </div>
            `);
        });
    };

    document.getElementById('btn-add-ingreso').addEventListener('click', () => {
        if(db.alumnos.length === 0 || db.suscripciones.length === 0) {
            alert("Debes tener al menos un Alumno y una Suscripción creados para registrar un pago.");
            return;
        }
        
        let alumnosOptions = db.alumnos.map(a => `<option value="${a.id}|${a.nombre}">${a.nombre}</option>`).join('');
        let subsOptions = db.suscripciones.map(s => `<option value="${s.nombre}|${s.valor}">${s.nombre} ($${Number(s.valor).toLocaleString('es-CL')})</option>`).join('');

        openModal('Registrar Ingreso (Manual)', `
            <form id="form-ingreso">
                <div class="input-group">
                    <i class="fa-solid fa-user"></i>
                    <select id="ing-alumno" required>
                        <option value="">Selecciona el Alumno</option>
                        ${alumnosOptions}
                    </select>
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-ticket"></i>
                    <select id="ing-sub" required>
                        <option value="">Selecciona el Plan (Suscripción)</option>
                        ${subsOptions}
                    </select>
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-calendar-day" style="z-index:2;"></i>
                    <input type="date" id="ing-fecha" required title="Fecha de Pago">
                </div>
                <p style="font-size:11px; color:var(--text-muted); text-align:center;">Nota: Los pagos manuales quedan marcados como "Pagados".</p>
                <button type="submit" class="btn-primary btn-sm" style="width:100%; margin-top:10px;">Guardar Pago</button>
            </form>
        `);
        
        document.getElementById('ing-fecha').valueAsDate = new Date();

        document.getElementById('form-ingreso').onsubmit = (e) => {
            e.preventDefault();
            const alData = document.getElementById('ing-alumno').value.split('|');
            const subData = document.getElementById('ing-sub').value.split('|');
            
            dbRef.collection("ingresos").add({
                alumnoNombre: alData[1],
                alumnoId: alData[0],
                suscripcion: subData[0],
                monto: parseInt(subData[1]),
                fecha: document.getElementById('ing-fecha').value,
                estado: 'pagado'
            }).then(() => {
                modal.classList.add('hidden');
            }).catch(err => alert("Error al guardar pago: " + err));
        };
    });

    window.deleteIngreso = (idx) => {
        if(confirm('¿Eliminar este registro de ingreso?')) {
            const ing = db.ingresos[idx];
            if (ing && ing.id) {
                dbRef.collection("ingresos").doc(ing.id).delete()
                    .catch(err => alert("Error al eliminar ingreso: " + err));
            }
        }
    };

    window.viewVoucher = (idx) => {
        const ing = db.ingresos[idx];
        const alumno = db.alumnos.find(a => a.nombre === ing.alumnoNombre);
        const caducidadFormat = alumno ? new Date(alumno.caducidad).toLocaleDateString('es-ES') : 'Fecha no calculada';
        const fechaPago = new Date(ing.fecha).toLocaleDateString('es-ES');

        openModal('Voucher de Pago', `
            <div style="background:var(--bg-color); padding:20px; border-radius:12px; border:2px dashed rgba(0,0,0,0.1); text-align:center;">
                <div style="width:50px; height:50px; border-radius:50%; background:var(--primary-gradient); display:flex; justify-content:center; align-items:center; color:white; font-size:24px; margin: 0 auto 10px; box-shadow:var(--shadow-glow);">
                    <i class="fa-solid fa-dumbbell"></i>
                </div>
                <h2 style="font-weight:900; margin-bottom:2px; color:var(--text-main); font-size:22px;">Leftraru<span style="color:var(--success-color);">box</span></h2>
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:20px;">Comprobante Oficial de Ingreso</p>
                
                <div style="text-align:left; background:white; padding:15px; border-radius:10px; font-size:14px; margin-bottom:20px; box-shadow:0 4px 10px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span style="color:var(--text-muted);">Alumno:</span>
                        <strong style="color:var(--text-main);">${ing.alumnoNombre}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span style="color:var(--text-muted);">Plan Adquirido:</span>
                        <strong style="color:var(--text-main);">${ing.suscripcion}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span style="color:var(--text-muted);">Fecha de Pago:</span>
                        <strong style="color:var(--text-main);">${fechaPago}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span style="color:var(--text-muted);">Válido hasta:</span>
                        <strong style="color:var(--danger-color);">${caducidadFormat}</strong>
                    </div>
                    <hr style="border:none; border-top:1px dashed #eee; margin:15px 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--text-muted); font-weight:800;">TOTAL PAGADO:</span>
                        <strong style="color:var(--success-color); font-size:20px;">$ ${Number(ing.monto).toLocaleString('es-CL')}</strong>
                    </div>
                </div>

                <div style="background:rgba(74, 222, 128, 0.1); padding:12px; border-radius:10px;">
                    <p style="font-size:13px; font-weight:600; color:var(--success-color); margin:0;">
                        ¡Bienvenido a Leftrarubox!<br>
                        <span style="font-weight:400; color:var(--text-muted); font-size:12px;">Estamos felices de tenerte con nosotros. ¡A darlo todo en este periodo!</span>
                    </p>
                </div>
            </div>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button class="btn-primary btn-sm" style="flex:1;" onclick="printVoucher(${idx})"><i class="fa-solid fa-file-pdf"></i> Generar PDF</button>
                <button class="btn-primary btn-sm" style="flex:1; background:var(--bg-color); color:var(--text-main);" onclick="document.getElementById('generic-modal').classList.add('hidden')">Cerrar</button>
            </div>
        `);
    };

    window.printVoucher = (idx) => {
        const ing = db.ingresos[idx];
        const alumno = db.alumnos.find(a => a.nombre === ing.alumnoNombre);
        const caducidadFormat = alumno ? new Date(alumno.caducidad).toLocaleDateString('es-ES') : 'Fecha no calculada';
        const fechaPago = new Date(ing.fecha).toLocaleDateString('es-ES');

        const printWin = window.open('', '_blank');
        printWin.document.write(`
            <html>
                <head>
                    <title>Voucher - ${ing.alumnoNombre}</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 40px; background: #fff; text-align: center; }
                        .voucher-box { border: 2px dashed #ccc; padding: 40px; border-radius: 15px; max-width: 400px; margin: 0 auto; background: #fcfcfc; }
                        .logo { width: 60px; height: 60px; border-radius: 50%; background: #3b82f6; color: white; display: flex; justify-content: center; align-items: center; font-size: 30px; margin: 0 auto 15px; }
                        h1 { margin: 0; color: #1e293b; font-size: 28px; }
                        h1 span { color: #10b981; }
                        p.subtitle { color: #64748b; font-size: 14px; margin-bottom: 30px; }
                        .data-row { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 16px; text-align:left; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                        .data-row span { color: #64748b; }
                        .data-row strong { color: #1e293b; }
                        .total-row { display: flex; justify-content: space-between; margin-top: 30px; font-size: 20px; font-weight: bold; color: #10b981; }
                        .footer-msg { margin-top: 30px; padding: 15px; background: #ecfdf5; border-radius: 10px; color: #10b981; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="voucher-box">
                        <div class="logo">💪</div>
                        <h1>Leftraru<span>box</span></h1>
                        <p class="subtitle">Comprobante Oficial de Ingreso</p>
                        
                        <div class="data-row"><span>Alumno:</span> <strong>${ing.alumnoNombre}</strong></div>
                        <div class="data-row"><span>Plan Adquirido:</span> <strong>${ing.suscripcion}</strong></div>
                        <div class="data-row"><span>Fecha de Pago:</span> <strong>${fechaPago}</strong></div>
                        <div class="data-row"><span>Válido hasta:</span> <strong style="color:#ef4444;">${caducidadFormat}</strong></div>
                        
                        <div class="total-row"><span>TOTAL PAGADO:</span> <span>$ ${Number(ing.monto).toLocaleString('es-CL')}</span></div>

                        <div class="footer-msg">
                            <strong>¡Bienvenido a Leftrarubox!</strong><br>
                            <span style="color:#64748b; font-weight:normal;">Estamos felices de tenerte con nosotros. ¡A darlo todo en este periodo!</span>
                        </div>
                    </div>
                    <script>
                        window.onload = () => { window.print(); window.setTimeout(() => window.close(), 500); }
                    </script>
                </body>
            </html>
        `);
        printWin.document.close();
    };


    // ==========================================
    // MÓDULO: PLANIFICACIÓN DE CLASES
    // ==========================================
    let planificacionFilter = 'proximas'; // 'proximas' o 'historial'

    const renderPlanificacion = () => {
        const container = document.getElementById('planificacion-list');
        container.innerHTML = '';
        if(!db.clases || db.clases.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:14px; width:100%;">No hay clases planificadas.</p>';
            return;
        }

        // Determinar fecha y hora actual para el filtro
        const now = new Date();
        let filteredClases = db.clases.filter(c => {
            const classDate = new Date(c.fecha + 'T' + c.hora);
            const isPast = classDate < now;
            return planificacionFilter === 'proximas' ? !isPast : isPast;
        });

        // Ordenar clases
        if (planificacionFilter === 'proximas') {
            // Próximas: De la más cercana a la más lejana
            filteredClases.sort((a, b) => new Date(a.fecha + 'T' + a.hora) - new Date(b.fecha + 'T' + b.hora));
        } else {
            // Historial: De la más reciente a la más antigua
            filteredClases.sort((a, b) => new Date(b.fecha + 'T' + b.hora) - new Date(a.fecha + 'T' + a.hora));
        }

        if (filteredClases.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted); font-size:14px; width:100%; text-align:center; padding:20px;">No hay clases en esta sección.</p>`;
            return;
        }

        filteredClases.forEach((clase) => {
            const originalIdx = db.clases.findIndex(c => c.id === clase.id);
            const fechaParts = clase.fecha.split('-');
            const dateObj = new Date(fechaParts[0], fechaParts[1] - 1, fechaParts[2]);
            const fechaFormat = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }).replace('.', '');
            
            const ejList = (clase.ejercicios || []).map(e => e.nombre).join(', ') || 'Sin ejercicios';
            const inscritosCount = clase.alumnosInscritos ? clase.alumnosInscritos.length : 0;
            const asistieronCount = clase.alumnosAsistieron ? clase.alumnosAsistieron.length : 0;

            let attendanceIndicator = '';
            let attendanceBtn = '';
            
            if (planificacionFilter === 'historial') {
                attendanceIndicator = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px; background:#f0fdf4; padding:6px 10px; border-radius:8px; border:1px solid #bbf7d0;">
                        <span style="color:#16a34a; font-weight:600;"><i class="fa-solid fa-clipboard-user" style="margin-right:4px;"></i> Asistencia:</span>
                        <strong style="color:#15803d;">${asistieronCount} / ${inscritosCount} Alumnos</strong>
                    </div>
                `;
                attendanceBtn = `
                    <button class="btn-primary btn-sm" onclick="viewClassAttendance('${clase.id}')" style="padding:6px 12px; font-size:12px; border-radius:8px; width:auto; margin:0; background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; cursor:pointer; font-weight:800;">
                        <i class="fa-solid fa-clipboard-check"></i> Ver Asistencia
                    </button>
                `;
            }

            container.innerHTML += `
                <div class="data-card" style="min-width: 300px; border-top: 4px solid ${planificacionFilter === 'proximas' ? 'var(--primary-color)' : '#94a3b8'};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <span style="font-size:12px; font-weight:800; background:var(--bg-color); padding:4px 10px; border-radius:10px; color:var(--text-main);"><i class="fa-regular fa-calendar" style="margin-right:5px; color:var(--primary-color);"></i>${fechaFormat}</span>
                        <div style="font-size:16px; font-weight:800; color:var(--text-main);"><i class="fa-regular fa-clock" style="font-size:12px; margin-right:4px;"></i>${clase.hora}</div>
                    </div>
                    
                    <h4 style="margin-bottom:5px;">${clase.nombre || 'Clase de Entrenamiento'}</h4>
                    <p style="font-size:13px; margin-bottom:15px; color:var(--text-main);"><i class="fa-solid fa-user-tie" style="color:var(--text-muted); margin-right:5px;"></i> Prof. ${clase.profesor}</p>
                    
                    <div style="background:#f8fafc; padding:12px; border-radius:12px; margin-bottom:15px; border:1px solid rgba(0,0,0,0.02);">
                        ${attendanceIndicator}
                        <div style="display:flex; justify-content:space-between; font-size:12px;">
                            <span style="color:var(--text-muted);"><i class="fa-solid fa-users-line" style="color:#3b82f6; margin-right:4px;"></i> Inscritos:</span>
                            <strong>${inscritosCount} Alumnos</strong>
                        </div>
                    </div>

                    <p style="font-size:11px; color:var(--text-muted); margin-bottom:15px; line-height:1.4;"><strong>Ejercicios:</strong> ${ejList}</p>

                    <div class="card-actions" style="justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:6px;">
                            <button class="btn-primary btn-sm" onclick="printListaClase(${originalIdx})" style="padding:6px 12px; font-size:12px; border-radius:8px; width:auto; margin:0;"><i class="fa-solid fa-file-pdf"></i> Lista</button>
                            ${attendanceBtn}
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button class="btn-icon" onclick="editClase(${originalIdx})" title="Modificar"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-icon delete" onclick="deleteClase(${originalIdx})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
        });
    };

    // Configurar Listeners de Pestañas de Planificación
    const btnFilterProximas = document.getElementById('btn-filter-proximas');
    const btnFilterHistorial = document.getElementById('btn-filter-historial');

    if (btnFilterProximas && btnFilterHistorial) {
        btnFilterProximas.onclick = () => {
            planificacionFilter = 'proximas';
            btnFilterProximas.style.background = '#678070';
            btnFilterProximas.style.color = 'white';
            btnFilterHistorial.style.background = '#f1f5f9';
            btnFilterHistorial.style.color = '#475569';
            renderPlanificacion();
        };

        btnFilterHistorial.onclick = () => {
            planificacionFilter = 'historial';
            btnFilterHistorial.style.background = '#678070';
            btnFilterHistorial.style.color = 'white';
            btnFilterProximas.style.background = '#f1f5f9';
            btnFilterProximas.style.color = '#475569';
            renderPlanificacion();
        };
    }

    // Modal de Historial de Asistencia para el Administrador
    window.viewClassAttendance = (claseId) => {
        const clase = db.clases.find(c => c.id === claseId);
        if(!clase) return;
        
        const inscritos = clase.alumnosInscritos || [];
        const asistieron = clase.alumnosAsistieron || [];
        const asistieronEmails = asistieron.map(a => a.correo.trim().toLowerCase());
        
        let presentHtml = '';
        let absentHtml = '';
        
        inscritos.forEach(correo => {
            const al = db.alumnos.find(a => a.correo && a.correo.trim().toLowerCase() === correo.trim().toLowerCase());
            const nombre = al ? al.nombre : correo;
            
            const attended = asistieronEmails.includes(correo.trim().toLowerCase());
            
            if (attended) {
                presentHtml += `
                    <div style="display:flex; align-items:center; gap:10px; padding:10px; background:#f0fdf4; border-radius:10px; margin-bottom:8px; border:1px solid #bbf7d0;">
                        <i class="fa-solid fa-circle-check" style="color:#16a34a; font-size:16px;"></i>
                        <div>
                            <p style="margin:0; font-size:13px; font-weight:700; color:#1e293b;">${nombre}</p>
                            <p style="margin:0; font-size:10px; color:#475569;">${correo}</p>
                        </div>
                    </div>
                `;
            } else {
                absentHtml += `
                    <div style="display:flex; align-items:center; gap:10px; padding:10px; background:#fef2f2; border-radius:10px; margin-bottom:8px; border:1px solid #fecaca;">
                        <i class="fa-solid fa-circle-xmark" style="color:#dc2626; font-size:16px;"></i>
                        <div>
                            <p style="margin:0; font-size:13px; font-weight:700; color:#1e293b;">${nombre}</p>
                            <p style="margin:0; font-size:10px; color:#475569;">${correo}</p>
                        </div>
                    </div>
                `;
            }
        });
        
        if (!presentHtml) presentHtml = '<p style="color:#94a3b8; font-size:12px; text-align:center; padding:20px; background:#f8fafc; border-radius:10px; border:1px dashed #e2e8f0;">Ningún alumno marcado presente.</p>';
        if (!absentHtml) absentHtml = '<p style="color:#94a3b8; font-size:12px; text-align:center; padding:20px; background:#f8fafc; border-radius:10px; border:1px dashed #e2e8f0;">Ningún alumno ausente.</p>';
        
        openModal(`Auditoría de Asistencia - ${clase.nombre || 'Clase'}`, `
            <div style="text-align:left;">
                <div style="display:flex; justify-content:space-between; margin-bottom:20px; background:#f8fafc; padding:12px 15px; border-radius:12px; border:1px solid #e2e8f0; font-size:13px;">
                    <div>Fecha: <strong>${new Date(clase.fecha + 'T00:00:00').toLocaleDateString('es-ES', {day:'numeric', month:'long', year:'numeric'})}</strong></div>
                    <div>Hora: <strong>${clase.hora}</strong></div>
                    <div>Profesor: <strong>${clase.profesor}</strong></div>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; max-height:350px; overflow-y:auto; padding-right:5px;">
                    <div>
                        <h4 style="font-size:13px; color:#16a34a; margin:0 0 12px 0; border-bottom:2px solid #bbf7d0; padding-bottom:6px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;"><i class="fa-solid fa-user-check"></i> Presentes (${asistieron.length})</h4>
                        ${presentHtml}
                    </div>
                    <div>
                        <h4 style="font-size:13px; color:#dc2626; margin:0 0 12px 0; border-bottom:2px solid #fecaca; padding-bottom:6px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;"><i class="fa-solid fa-user-xmark"></i> Ausentes (${inscritos.length - asistieron.length})</h4>
                        ${absentHtml}
                    </div>
                </div>
            </div>
        `);
    };

    window.printListaClase = (idx) => {
        const clase = db.clases[idx];
        const fechaParts = clase.fecha.split('-');
        const dateObj = new Date(fechaParts[0], fechaParts[1] - 1, fechaParts[2]);
        const fechaFormat = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
        
        let alumnosHtml = '';
        const asistieron = clase.alumnosAsistieron || [];
        const asistieronEmails = asistieron.map(a => a.correo.trim().toLowerCase());
        const tieneAsistencia = asistieron.length > 0;

        if(clase.alumnosInscritos && clase.alumnosInscritos.length > 0) {
            clase.alumnosInscritos.forEach((correo, i) => {
                const al = db.alumnos.find(a => a.correo && a.correo.trim().toLowerCase() === correo.trim().toLowerCase());
                const nombre = al ? al.nombre : correo;
                
                let checkPresent = '[   ]';
                let checkAbsent = '[   ]';
                
                if (tieneAsistencia) {
                    const attended = asistieronEmails.includes(correo.trim().toLowerCase());
                    if (attended) {
                        checkPresent = '<span style="color:#10b981; font-weight:bold;">[  X  ]</span>';
                    } else {
                        checkAbsent = '<span style="color:#ef4444; font-weight:bold;">[  X  ]</span>';
                    }
                }
                
                alumnosHtml += `
                    <tr>
                        <td style="text-align:center;">${i+1}</td>
                        <td>${nombre}</td>
                        <td style="text-align:center; font-family:monospace; font-size:16px;">${checkPresent}</td>
                        <td style="text-align:center; font-family:monospace; font-size:16px;">${checkAbsent}</td>
                    </tr>
                `;
            });
        } else {
            alumnosHtml = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#666;">No hay alumnos inscritos en esta clase.</td></tr>';
        }

        const printWin = window.open('', '_blank');
        printWin.document.write(`
            <html>
                <head>
                    <title>Lista de Asistencia - ${clase.nombre}</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 40px; background: #fff; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
                        h1 { margin: 0; color: #1e293b; font-size: 24px; }
                        .meta { color: #64748b; font-size: 14px; text-align: right; }
                        .meta strong { color: #1e293b; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ccc; padding: 12px; text-align: left; }
                        th { background: #f8fafc; font-weight: bold; color: #1e293b; text-transform: uppercase; font-size: 12px; }
                        tr:nth-child(even) { background: #fbfbfc; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <h1>Lista de Asistencia: ${clase.nombre || 'Entrenamiento'}</h1>
                            <p style="margin:5px 0 0 0; color:#3b82f6; font-weight:bold; font-size:18px;">Leftraru<span style="color:#10b981;">box</span></p>
                        </div>
                        <div class="meta">
                            <div>Fecha: <strong>${fechaFormat}</strong></div>
                            <div>Hora: <strong>${clase.hora}</strong></div>
                            <div>Profesor: <strong>${clase.profesor}</strong></div>
                            <div>Alumnos inscritos: <strong>${clase.alumnosInscritos ? clase.alumnosInscritos.length : 0}</strong></div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th style="text-align:center; width:5%;">Nº</th>
                                <th style="width:55%;">Nombre del Alumno</th>
                                <th style="text-align:center; width:20%;">Asistió</th>
                                <th style="text-align:center; width:20%;">Ausente</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${alumnosHtml}
                        </tbody>
                    </table>
                    
                    <div style="margin-top:50px; text-align:right; color:#64748b; font-size:14px; padding-right:50px;">
                        ________________________________________<br>
                        Firma del Profesor
                    </div>
                    
                    <script>
                        window.onload = () => { window.print(); window.setTimeout(() => window.close(), 500); }
                    </script>
                </body>
            </html>
        `);
        printWin.document.close();
    };

    document.getElementById('btn-add-clase').addEventListener('click', () => {
        if(db.profesores.length === 0) {
            alert("Debes crear al menos un Profesor en el módulo de Personal antes de planificar clases.");
            return;
        }

        let profOptions = db.profesores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
        
        let ejOptions = db.ejercicios.map(e => `
            <label style="display:flex; align-items:center; gap:8px; font-size:13px; padding:5px 0; cursor:pointer;">
                <input type="checkbox" name="clase-ejs" value="${e.nombre}"> <span>${e.nombre}</span> <span style="font-size:10px; color:#aaa;">(${e.musculo || 'Gral'})</span>
            </label>
        `).join('');
        if(!ejOptions) ejOptions = '<p style="font-size:12px; color:#999;">No hay ejercicios creados.</p>';

        openModal('Planificar Clase', `
            <form id="form-clase">
                <div class="input-group">
                    <i class="fa-solid fa-dumbbell"></i>
                    <input type="text" id="cl-nombre" placeholder="Nombre de la Clase (ej. Funcional, Crossfit)" required>
                </div>
                <div style="display:flex; gap:15px; margin-bottom:15px;">
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-calendar-day" style="z-index:2;"></i>
                        <input type="date" id="cl-fecha" required title="Fecha de la clase">
                    </div>
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-clock" style="z-index:2;"></i>
                        <input type="time" id="cl-hora" required title="Hora de inicio">
                    </div>
                </div>

                <div class="input-group">
                    <i class="fa-solid fa-user-tie"></i>
                    <select id="cl-profesor" required>
                        <option value="">Seleccionar Profesor</option>
                        ${profOptions}
                    </select>
                </div>

                <div style="background:var(--bg-color); padding:15px; border-radius:12px; border:1px solid rgba(0,0,0,0.05); margin-bottom:15px;">
                    <h5 style="font-size:13px; margin-bottom:10px; color:var(--text-main);">Ejercicios Asignados (Opcional)</h5>
                    <div style="max-height:110px; overflow-y:auto; padding-right:5px;">
                        ${ejOptions}
                    </div>
                </div>

                <button type="submit" class="btn-primary btn-sm" style="width:100%;">Crear Clase</button>
            </form>
        `);

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('cl-fecha').value = `${yyyy}-${mm}-${dd}`;

        document.getElementById('form-clase').onsubmit = (e) => {
            e.preventDefault();
            const ejs = Array.from(document.querySelectorAll('input[name="clase-ejs"]:checked')).map(cb => { return { nombre: cb.value }; });

            dbRef.collection("clases").add({
                nombre: document.getElementById('cl-nombre').value,
                fecha: document.getElementById('cl-fecha').value,
                hora: document.getElementById('cl-hora').value,
                profesor: document.getElementById('cl-profesor').value,
                ejercicios: ejs,
                alumnosInscritos: []
            }).then(() => {
                document.getElementById('generic-modal').classList.add('hidden');
            }).catch(err => alert("Error al guardar clase: " + err));
        };
    });

    window.deleteClase = (idx) => {
        if(confirm('¿Seguro que deseas eliminar esta clase? Se perderán las reservas de los alumnos inscritos.')) {
            const cl = db.clases[idx];
            if (cl && cl.id) {
                dbRef.collection("clases").doc(cl.id).delete()
                    .catch(err => alert("Error al eliminar clase: " + err));
            }
        }
    };

    window.editClase = (idx) => {
        const clase = db.clases[idx];
        let profOptions = db.profesores.map(p => `<option value="${p.nombre}" ${p.nombre===clase.profesor?'selected':''}>${p.nombre}</option>`).join('');
        
        let ejOptions = db.ejercicios.map(e => {
            const isChecked = clase.ejercicios && clase.ejercicios.some(ce => ce.nombre === e.nombre) ? 'checked' : '';
            return `
            <label style="display:flex; align-items:center; gap:8px; font-size:13px; padding:5px 0; cursor:pointer;">
                <input type="checkbox" name="clase-ejs" value="${e.nombre}" ${isChecked}> <span>${e.nombre}</span> <span style="font-size:10px; color:#aaa;">(${e.musculo || 'Gral'})</span>
            </label>`;
        }).join('');

        openModal('Modificar Clase', `
            <form id="form-clase-edit">
                <div class="input-group">
                    <i class="fa-solid fa-dumbbell"></i>
                    <input type="text" id="cl-nombre" value="${clase.nombre || ''}" placeholder="Nombre de la Clase" required>
                </div>
                <div style="display:flex; gap:15px; margin-bottom:15px;">
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-calendar-day" style="z-index:2;"></i>
                        <input type="date" id="cl-fecha" value="${clase.fecha}" required>
                    </div>
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-clock" style="z-index:2;"></i>
                        <input type="time" id="cl-hora" value="${clase.hora}" required>
                    </div>
                </div>

                <div class="input-group">
                    <i class="fa-solid fa-user-tie"></i>
                    <select id="cl-profesor" required>
                        <option value="">Seleccionar Profesor</option>
                        ${profOptions}
                    </select>
                </div>

                <div style="background:var(--bg-color); padding:15px; border-radius:12px; border:1px solid rgba(0,0,0,0.05); margin-bottom:15px;">
                    <h5 style="font-size:13px; margin-bottom:10px; color:var(--text-main);">Ejercicios Asignados</h5>
                    <div style="max-height:110px; overflow-y:auto; padding-right:5px;">
                        ${ejOptions}
                    </div>
                </div>

                <button type="submit" class="btn-primary btn-sm" style="width:100%;">Guardar Cambios</button>
            </form>
        `);

        document.getElementById('form-clase-edit').onsubmit = (e) => {
            e.preventDefault();
            const ejs = Array.from(document.querySelectorAll('input[name="clase-ejs"]:checked')).map(cb => { return { nombre: cb.value }; });

            dbRef.collection("clases").doc(clase.id).set({
                nombre: document.getElementById('cl-nombre').value,
                fecha: document.getElementById('cl-fecha').value,
                hora: document.getElementById('cl-hora').value,
                profesor: document.getElementById('cl-profesor').value,
                ejercicios: ejs,
                alumnosInscritos: clase.alumnosInscritos || [],
                alumnosAsistieron: clase.alumnosAsistieron || [],
                asistenciaGrabada: !!clase.asistenciaGrabada
            }).then(() => {
                document.getElementById('generic-modal').classList.add('hidden');
            }).catch(err => alert("Error al guardar cambios de clase: " + err));
        };
    };

    // ==========================================
    // MÓDULO: PROFESORES, SUSCRIPCIONES, EJERCICIOS, CONFIG
    // ==========================================
    const renderProfesores = () => {
        const container = document.getElementById('profesores-list');
        container.innerHTML = '';
        if(db.profesores.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:14px; width:100%;">No hay personal registrado.</p>';
            return;
        }
        db.profesores.forEach((prof, idx) => {
            container.innerHTML += `
                <div class="data-card" style="min-width: 280px; flex-grow:1; max-width:400px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                        <div style="display:flex; gap:15px; align-items:center;">
                            <div style="width:45px; height:45px; border-radius:50%; background:var(--primary-gradient); display:flex; justify-content:center; align-items:center; color:white; font-size:18px; flex-shrink:0; box-shadow:var(--shadow-glow); overflow:hidden;">
                                ${prof.foto ? `<img src="${prof.foto}" style="width:100%; height:100%; object-fit:cover;">` : '<i class="fa-solid fa-user-tie"></i>'}
                            </div>
                            <div>
                                <h4 style="margin:0 0 2px 0; font-size:16px;">${prof.nombre}</h4>
                                <p style="margin:0 0 2px 0; font-size:12px; color:var(--text-muted);"><i class="fa-solid fa-envelope" style="margin-right:5px;"></i>${prof.correo || 'Sin correo'}</p>
                                <p style="margin:0; font-size:12px; color:var(--text-muted);"><i class="fa-solid fa-phone" style="font-size:11px; margin-right:5px;"></i> ${prof.telefono || 'Sin teléfono'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon" onclick="editProfesor(${idx})" title="Modificar"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon delete" onclick="deleteProfesor(${idx})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    };

    document.getElementById('btn-add-profesor').addEventListener('click', () => {
        openModal('Nuevo Profesor', `
            <form id="form-profesor" autocomplete="off">
                <div class="input-group">
                    <i class="fa-solid fa-user"></i>
                    <input type="text" id="prof-nombre" placeholder="Nombre completo" required autocomplete="off">
                </div>
                <div class="input-group" style="padding:10px 15px; display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-camera"></i>
                    <input type="file" id="prof-foto" accept="image/*" style="padding:0; border:none; background:transparent; font-size:13px;" title="Foto del Profesor (Opcional)">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-phone"></i>
                    <input type="text" id="prof-tel" placeholder="Teléfono de contacto (opcional)" autocomplete="off">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-envelope"></i>
                    <input type="email" id="prof-correo" placeholder="Correo electrónico de acceso" required autocomplete="off">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-lock"></i>
                    <input type="password" id="prof-pass" placeholder="Contraseña de acceso" required autocomplete="off">
                </div>
                <button type="submit" class="btn-primary btn-sm" style="width:100%; margin-top:10px;">Guardar Profesor</button>
            </form>
        `);
        document.getElementById('form-profesor').onsubmit = (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('prof-foto');
            const file = fileInput.files[0];

            const guardarProfesor = (fotoBase64) => {
                dbRef.collection("profesores").add({
                    nombre: document.getElementById('prof-nombre').value,
                    telefono: document.getElementById('prof-tel').value,
                    correo: document.getElementById('prof-correo').value.trim().toLowerCase(),
                    password: document.getElementById('prof-pass').value,
                    foto: fotoBase64 || null
                }).then(() => {
                    modal.classList.add('hidden');
                }).catch(err => alert("Error al guardar profesor: " + err));
            };

            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => guardarProfesor(ev.target.result);
                reader.readAsDataURL(file);
            } else {
                guardarProfesor(null);
            }
        };
    });
    window.deleteProfesor = (idx) => {
        if(confirm('¿Eliminar profesor? Perderá sus credenciales de acceso.')) {
            const prof = db.profesores[idx];
            if (prof && prof.id) {
                dbRef.collection("profesores").doc(prof.id).delete()
                    .catch(err => alert("Error al eliminar: " + err));
            }
        }
    };
    window.editProfesor = (idx) => {
        const prof = db.profesores[idx];
        openModal('Modificar Profesor', `
            <form id="form-profesor-edit" autocomplete="off">
                <div class="input-group">
                    <i class="fa-solid fa-user"></i>
                    <input type="text" id="prof-nombre" value="${prof.nombre}" required>
                </div>
                <div class="input-group" style="padding:10px 15px; display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-camera"></i>
                    <input type="file" id="prof-foto-edit" accept="image/*" style="padding:0; border:none; background:transparent; font-size:13px;" title="Actualizar Foto (Opcional)">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-phone"></i>
                    <input type="text" id="prof-tel" value="${prof.telefono || ''}">
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-envelope"></i>
                    <input type="email" id="prof-correo" value="${prof.correo || ''}" placeholder="Correo electrónico" required>
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-lock"></i>
                    <input type="text" id="prof-pass" value="${prof.password || ''}" placeholder="Contraseña" required>
                </div>
                <button type="submit" class="btn-primary btn-sm" style="width:100%; margin-top:10px;">Guardar Cambios</button>
            </form>
        `);
        document.getElementById('form-profesor-edit').onsubmit = (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('prof-foto-edit');
            const file = fileInput.files[0];

            const actualizarProfesor = (fotoBase64) => {
                dbRef.collection("profesores").doc(prof.id).set({
                    nombre: document.getElementById('prof-nombre').value,
                    telefono: document.getElementById('prof-tel').value,
                    correo: document.getElementById('prof-correo').value.trim().toLowerCase(),
                    password: document.getElementById('prof-pass').value,
                    foto: fotoBase64 || prof.foto || null
                }).then(() => {
                    modal.classList.add('hidden');
                }).catch(err => alert("Error al guardar cambios: " + err));
            };

            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => actualizarProfesor(ev.target.result);
                reader.readAsDataURL(file);
            } else {
                actualizarProfesor(prof.foto);
            }
        };
    };

    const renderSuscripciones = () => {
        const container = document.getElementById('suscripciones-list');
        container.innerHTML = '';
        if(db.suscripciones.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:14px; width:100%;">No hay planes de suscripción.</p>';
            return;
        }
        db.suscripciones.forEach((sub, idx) => {
            container.innerHTML += `
                <div class="data-card">
                    <span class="badge">$ ${Number(sub.valor).toLocaleString('es-CL')}</span>
                    <h4>${sub.nombre}</h4>
                    <p>${sub.descripcion}</p>
                    <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:12px; color:var(--text-muted);">
                        <span><i class="fa-solid fa-calendar-days" style="margin-right:5px;"></i> ${sub.duracion || 30} días</span>
                        <span><i class="fa-solid fa-bolt" style="margin-right:5px; color:#f59e0b;"></i> ${sub.dias || 0} clases</span>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon" onclick="editSuscripcion(${idx})" title="Modificar"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon delete" onclick="deleteSuscripcion(${idx})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    };

    document.getElementById('btn-add-suscripcion').addEventListener('click', () => {
        openModal('Nueva Suscripción', `
            <form id="form-sub">
                <div class="input-group"><i class="fa-solid fa-ticket"></i><input type="text" id="sub-nombre" placeholder="Nombre (ej. Plan Mensual Básico)" required></div>
                <div class="input-group"><i class="fa-solid fa-align-left" style="top:25px;"></i><textarea id="sub-desc" placeholder="Breve reseña del plan..." required></textarea></div>
                <div class="input-group"><i class="fa-solid fa-dollar-sign"></i><input type="number" id="sub-valor" placeholder="Valor/Precio" required></div>
                <div style="display:flex; gap:15px; margin-bottom:15px;">
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-bolt" style="color:#f59e0b;"></i>
                        <input type="number" id="sub-dias" placeholder="Clases incluidas (créditos)" required min="0">
                    </div>
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-calendar-days"></i>
                        <input type="number" id="sub-duracion" placeholder="Vigencia (días, ej. 30)" required min="1">
                    </div>
                </div>
                <button type="submit" class="btn-primary btn-sm" style="width:100%; margin-top:10px;">Guardar Plan</button>
            </form>
        `);
        document.getElementById('form-sub').onsubmit = (e) => {
            e.preventDefault();
            dbRef.collection("suscripciones").add({
                nombre: document.getElementById('sub-nombre').value,
                descripcion: document.getElementById('sub-desc').value,
                valor: parseInt(document.getElementById('sub-valor').value),
                dias: parseInt(document.getElementById('sub-dias').value),
                duracion: parseInt(document.getElementById('sub-duracion').value)
            }).then(() => {
                modal.classList.add('hidden');
            }).catch(err => alert("Error al guardar plan: " + err));
        };
    });
    window.deleteSuscripcion = (idx) => {
        if(confirm('¿Eliminar esta suscripción?')) {
            const sub = db.suscripciones[idx];
            if (sub && sub.id) {
                dbRef.collection("suscripciones").doc(sub.id).delete()
                    .catch(err => alert("Error al eliminar suscripción: " + err));
            }
        }
    };
    window.editSuscripcion = (idx) => {
        const sub = db.suscripciones[idx];
        openModal('Modificar Suscripción', `
            <form id="form-sub-edit">
                <div class="input-group"><i class="fa-solid fa-ticket"></i><input type="text" id="sub-nombre" value="${sub.nombre}" required></div>
                <div class="input-group"><i class="fa-solid fa-align-left" style="top:25px;"></i><textarea id="sub-desc" required>${sub.descripcion}</textarea></div>
                <div class="input-group"><i class="fa-solid fa-dollar-sign"></i><input type="number" id="sub-valor" value="${sub.valor}" required></div>
                <div style="display:flex; gap:15px; margin-bottom:15px;">
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-bolt" style="color:#f59e0b;"></i>
                        <input type="number" id="sub-dias" value="${sub.dias || 0}" placeholder="Clases incluidas (créditos)" required min="0">
                    </div>
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <i class="fa-solid fa-calendar-days"></i>
                        <input type="number" id="sub-duracion" value="${sub.duracion || 30}" placeholder="Vigencia (días, ej. 30)" required min="1">
                    </div>
                </div>
                <button type="submit" class="btn-primary btn-sm" style="width:100%; margin-top:10px;">Guardar Cambios</button>
            </form>
        `);
        document.getElementById('form-sub-edit').onsubmit = (e) => {
            e.preventDefault();
            dbRef.collection("suscripciones").doc(sub.id).set({
                nombre: document.getElementById('sub-nombre').value,
                descripcion: document.getElementById('sub-desc').value,
                valor: parseInt(document.getElementById('sub-valor').value),
                dias: parseInt(document.getElementById('sub-dias').value),
                duracion: parseInt(document.getElementById('sub-duracion').value)
            }).then(() => {
                modal.classList.add('hidden');
            }).catch(err => alert("Error al guardar cambios: " + err));
        };
    };

    const renderEjercicios = () => {
        const container = document.getElementById('ejercicios-list');
        container.innerHTML = '';
        if(db.ejercicios.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:14px; width:100%;">Aún no has creado ejercicios.</p>';
            return;
        }
        db.ejercicios.forEach((ej, idx) => {
            container.innerHTML += `
                <div class="data-card">
                    <span class="badge">${ej.musculo || 'General / Fullbody'}</span>
                    <h4>${ej.nombre}</h4>
                    <div class="card-actions">
                        <button class="btn-icon" onclick="editEjercicio(${idx})" title="Modificar"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon delete" onclick="deleteEjercicio(${idx})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    };

    document.getElementById('btn-add-ejercicio').addEventListener('click', () => {
        openModal('Nuevo Ejercicio', `
            <form id="form-ej">
                <div class="input-group"><i class="fa-solid fa-person-running"></i><input type="text" id="ej-nombre" placeholder="Nombre del Ejercicio" required></div>
                <div class="input-group">
                    <i class="fa-solid fa-child-reaching"></i>
                    <select id="ej-musculo">
                        <option value="">Selecciona zona muscular (opcional)</option>
                        <option value="Pecho">Pecho</option>
                        <option value="Espalda">Espalda</option>
                        <option value="Piernas">Piernas</option>
                        <option value="Brazos">Brazos</option>
                        <option value="Hombros">Hombros</option>
                        <option value="Core/Abdomen">Core/Abdomen</option>
                        <option value="Glúteos">Glúteos</option>
                        <option value="Cardio">Cardio / General</option>
                    </select>
                </div>
                <button type="submit" class="btn-primary btn-sm" style="width:100%; margin-top:10px;">Guardar Ejercicio</button>
            </form>
        `);
        document.getElementById('form-ej').onsubmit = (e) => {
            e.preventDefault();
            dbRef.collection("ejercicios").add({
                nombre: document.getElementById('ej-nombre').value,
                musculo: document.getElementById('ej-musculo').value
            }).then(() => {
                modal.classList.add('hidden');
            }).catch(err => alert("Error al guardar ejercicio: " + err));
        };
    });
    window.deleteEjercicio = (idx) => {
        if(confirm('¿Eliminar ejercicio?')) {
            const ej = db.ejercicios[idx];
            if (ej && ej.id) {
                dbRef.collection("ejercicios").doc(ej.id).delete()
                    .catch(err => alert("Error al eliminar: " + err));
            }
        }
    };
    window.editEjercicio = (idx) => {
        const ej = db.ejercicios[idx];
        openModal('Modificar Ejercicio', `
            <form id="form-ej-edit">
                <div class="input-group"><i class="fa-solid fa-person-running"></i><input type="text" id="ej-nombre" value="${ej.nombre}" required></div>
                <div class="input-group">
                    <i class="fa-solid fa-child-reaching"></i>
                    <select id="ej-musculo">
                        <option value="">Selecciona zona muscular (opcional)</option>
                        <option value="Pecho" ${ej.musculo==='Pecho'?'selected':''}>Pecho</option>
                        <option value="Espalda" ${ej.musculo==='Espalda'?'selected':''}>Espalda</option>
                        <option value="Piernas" ${ej.musculo==='Piernas'?'selected':''}>Piernas</option>
                        <option value="Brazos" ${ej.musculo==='Brazos'?'selected':''}>Brazos</option>
                        <option value="Hombros" ${ej.musculo==='Hombros'?'selected':''}>Hombros</option>
                        <option value="Core/Abdomen" ${ej.musculo==='Core/Abdomen'?'selected':''}>Core/Abdomen</option>
                        <option value="Glúteos" ${ej.musculo==='Glúteos'?'selected':''}>Glúteos</option>
                        <option value="Cardio" ${ej.musculo==='Cardio'?'selected':''}>Cardio / General</option>
                    </select>
                </div>
                <button type="submit" class="btn-primary btn-sm" style="width:100%; margin-top:10px;">Guardar Cambios</button>
            </form>
        `);
        document.getElementById('form-ej-edit').onsubmit = (e) => {
            e.preventDefault();
            dbRef.collection("ejercicios").doc(ej.id).set({
                nombre: document.getElementById('ej-nombre').value,
                musculo: document.getElementById('ej-musculo').value
            }).then(() => {
                modal.classList.add('hidden');
            }).catch(err => alert("Error al guardar cambios: " + err));
        };
    };

    const inputHoras = document.getElementById('horas-limite');
    const inputWhatsapp = document.getElementById('config-whatsapp');
    
    inputHoras.value = db.configuracion.horasLimite || 2;
    if (inputWhatsapp) inputWhatsapp.value = db.configuracion.whatsapp || '';

    document.getElementById('btn-save-config').addEventListener('click', () => {
        const val = parseInt(inputHoras.value);
        const waVal = inputWhatsapp ? inputWhatsapp.value.trim() : '';
        if(val >= 0) {
            dbRef.collection("configuracion").doc("global").set({
                horasLimite: val,
                whatsapp: waVal
            }).then(() => {
                const btn = document.getElementById('btn-save-config');
                const originalText = btn.innerText;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardado';
                btn.style.background = 'var(--success-color)';
                setTimeout(() => { btn.innerText = originalText; btn.style.background = 'var(--primary-gradient)'; }, 2000);
            }).catch(err => alert("Error al guardar configuración: " + err));
        }
    });

    // --- INICIALIZACIÓN ---
    console.log("Sistema administrativo inicializado con Firebase Firestore en tiempo real.");
});
