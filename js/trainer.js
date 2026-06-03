// js/trainer.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. Proteger Ruta de Profesor
    if (sessionStorage.getItem('leftraru_role') !== 'profesor') {
        window.location.href = 'index.html';
        return;
    }

    const currentProfessorEmail = sessionStorage.getItem('leftraru_user');
    const currentProfessorName = sessionStorage.getItem('leftraru_prof_name');

    // 2. Base de Datos Reactiva en tiempo real
    let db = {
        clases: [],
        alumnos: []
    };

    let currentTab = 'hoy'; // 'hoy' o 'historial'
    let selectedClaseId = null;

    // Elementos del DOM
    const trainerNameEl = document.getElementById('trainer-name');
    const kpiClasesEl = document.getElementById('kpi-clases-hoy');
    const kpiAlumnosEl = document.getElementById('kpi-alumnos-hoy');
    const feedTitleEl = document.getElementById('feed-title');
    const clasesListEl = document.getElementById('trainer-clases-list');
    
    const tabHoyBtn = document.getElementById('tab-hoy');
    const tabHistorialBtn = document.getElementById('tab-historial');
    const btnLogout = document.getElementById('btn-logout');

    const modalAttendance = document.getElementById('modal-attendance');
    const modalClassTitle = document.getElementById('modal-class-title');
    const modalClassTime = document.getElementById('modal-class-time');
    const studentsAttendanceList = document.getElementById('students-attendance-list');
    const btnSaveAttendance = document.getElementById('btn-save-attendance');
    const btnCloseAttendance = document.getElementById('btn-close-attendance');

    // Cargar Nombre de Profesor en el Encabezado
    if (trainerNameEl) {
        trainerNameEl.innerText = currentProfessorName || 'Profesor';
    }

    // Formatear Fecha Local YYYY-MM-DD
    const getLocalDateStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayStr = getLocalDateStr();

    // Configurar Escuchadores en Tiempo Real de Firebase
    const setupRealtimeListeners = () => {
        // Escuchar Clases
        dbRef.collection("clases").onSnapshot(snap => {
            db.clases = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderDashboard();
            if (modalAttendance && !modalAttendance.classList.contains('hidden') && selectedClaseId) {
                renderAttendanceList(selectedClaseId);
            }
        });

        // Escuchar Alumnos (Para obtener nombres y fotos de perfil reales)
        dbRef.collection("alumnos").onSnapshot(snap => {
            db.alumnos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderDashboard();
            if (modalAttendance && !modalAttendance.classList.contains('hidden') && selectedClaseId) {
                renderAttendanceList(selectedClaseId);
            }
        });

        // Escuchar Profesores (Para obtener la foto de perfil en tiempo real en el avatar)
        dbRef.collection("profesores").onSnapshot(snap => {
            const profesores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const currentProf = profesores.find(p => p.correo && p.correo.trim().toLowerCase() === currentProfessorEmail.trim().toLowerCase());
            if (currentProf) {
                const avatarContainer = document.getElementById('trainer-avatar');
                if (avatarContainer) {
                    if (currentProf.foto) {
                        avatarContainer.innerHTML = `<img src="${currentProf.foto}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                    } else {
                        avatarContainer.innerHTML = `<i class="fa-solid fa-user-tie"></i>`;
                    }
                }
            }
        });
    };

    setupRealtimeListeners();

    // ==========================================
    // RENDERIZADO DEL PORTAL (DASHBOARD)
    // ==========================================
    const renderDashboard = () => {
        // 1. Filtrar Clases de este Profesor
        const misClases = db.clases.filter(c => c.profesor && c.profesor.trim().toLowerCase() === currentProfessorName.trim().toLowerCase());

        // Calcular la fecha de mañana en string de forma robusta
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

        // 2. Separar clases en Agenda (Hoy y Futuro) vs Historial (Pasado)
        const clasesHoy = misClases.filter(c => c.fecha === todayStr);
        const clasesAgenda = misClases.filter(c => c.fecha >= todayStr);
        const clasesHistorial = misClases.filter(c => c.fecha < todayStr);

        // Ordenar Clases
        // Agenda (Hoy + Futuras): Cronológico ascendente (Primero la fecha más cercana, luego la hora)
        clasesAgenda.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
        // Historial: De la más reciente a la más antigua (descendente)
        clasesHistorial.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora));

        // 3. Renderizar KPIs Bento (Siempre referidos de forma útil a la jornada del día actual)
        if (kpiClasesEl) kpiClasesEl.innerText = clasesHoy.length;
        
        let alumnosHoyCount = 0;
        clasesHoy.forEach(c => {
            alumnosHoyCount += c.alumnosInscritos ? c.alumnosInscritos.length : 0;
        });
        if (kpiAlumnosEl) kpiAlumnosEl.innerText = alumnosHoyCount;

        // 4. Seleccionar Feed Activo
        let clasesRender = [];
        if (currentTab === 'hoy') {
            clasesRender = clasesAgenda;
            if (feedTitleEl) feedTitleEl.innerText = "Mi Agenda de Clases";
        } else {
            clasesRender = clasesHistorial;
            if (feedTitleEl) feedTitleEl.innerText = "Historial de Clases Pasadas";
        }

        // 5. Inyectar Tarjetas de Clases
        clasesListEl.innerHTML = '';
        if (clasesRender.length === 0) {
            clasesListEl.innerHTML = `
                <div style="text-align:center; padding:40px; background:rgba(255,255,255,0.6); border-radius:20px; border:1px solid rgba(255,255,255,0.4);">
                    <i class="fa-solid fa-folder-open" style="font-size:32px; color:var(--text-muted); margin-bottom:10px;"></i>
                    <p style="margin:0; color:var(--text-muted); font-size:14px; font-weight:600;">No tienes clases planificadas para esta sección.</p>
                </div>
            `;
            return;
        }

        clasesRender.forEach(clase => {
            const inscritos = clase.alumnosInscritos ? clase.alumnosInscritos.length : 0;
            const asistieron = clase.alumnosAsistieron ? clase.alumnosAsistieron.length : 0;
            const tieneAsistencia = clase.alumnosAsistieron && clase.alumnosAsistieron.length > 0;
            
            // Separar fecha legible
            const fechaParts = clase.fecha.split('-');
            const dateObj = new Date(fechaParts[0], fechaParts[1] - 1, fechaParts[2]);
            const fechaFormateada = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
            // Primera letra del día en mayúscula
            const fechaMayuscula = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);

            // Estado visual de borde según si tiene asistencia o no y la vigencia
            let borderStyle = 'border-left: 5px solid #94a3b8;'; // Gris (Pendiente)
            if (tieneAsistencia) {
                borderStyle = 'border-left: 5px solid #10b981;'; // Verde (Completado)
            } else if (clase.fecha === todayStr) {
                borderStyle = 'border-left: 5px solid #3b82f6;'; // Azul (Hoy Activo)
            } else {
                borderStyle = 'border-left: 5px solid #8b5cf6;'; // Lila (Planificado Futuro)
            }

            // Crear el Badge dinámico de día/fecha premium
            let diaBadgeHTML = '';
            if (clase.fecha === todayStr) {
                diaBadgeHTML = `<span class="class-date-badge" style="background:rgba(59, 130, 246, 0.12); color:#3b82f6; border: 1px solid rgba(59, 130, 246, 0.15);"><i class="fa-solid fa-bolt" style="margin-right:3px;"></i> Hoy</span>`;
            } else if (clase.fecha === tomorrowStr) {
                diaBadgeHTML = `<span class="class-date-badge" style="background:rgba(139, 92, 246, 0.12); color:#8b5cf6; border: 1px solid rgba(139, 92, 246, 0.15);"><i class="fa-regular fa-calendar-days" style="margin-right:3px;"></i> Mañana</span>`;
            } else {
                diaBadgeHTML = `<span class="class-date-badge" style="background:rgba(71, 85, 105, 0.08); color:#475569; border: 1px solid rgba(71, 85, 105, 0.1);"><i class="fa-regular fa-calendar" style="margin-right:3px;"></i> ${fechaMayuscula}</span>`;
            }

            let asistenciaInfoHTML = '';
            if (tieneAsistencia) {
                asistenciaInfoHTML = `
                    <div class="class-attendance-bar">
                        <span class="label"><i class="fa-solid fa-circle-check"></i> Asistencia Registrada</span>
                        <span class="val">${asistieron} / ${inscritos} Alumnos</span>
                    </div>
                `;
            } else {
                asistenciaInfoHTML = `
                    <div class="class-attendance-bar" style="background:#fff7ed; border-color:#fed7aa;">
                        <span class="label" style="color:#d97706;"><i class="fa-regular fa-clock"></i> Pendiente de Registro</span>
                        <span class="val" style="color:#d97706;">${inscritos} Inscritos</span>
                    </div>
                `;
            }

            const card = document.createElement('div');
            card.className = 'class-card-trainer';
            card.style = borderStyle;
            card.innerHTML = `
                <div class="class-card-header">
                    <span class="class-time"><i class="fa-regular fa-clock" style="color:#678070; font-size:13px;"></i> ${clase.hora} hs</span>
                    ${diaBadgeHTML}
                </div>
                <h3 class="class-name">${clase.nombre || 'Entrenamiento'}</h3>
                <div class="class-stats">
                    <div class="stat-item"><i class="fa-solid fa-users-line" style="color:#3b82f6;"></i> Inscritos: <strong>${inscritos} / ${clase.cupos}</strong></div>
                    <div class="stat-item"><i class="fa-solid fa-fire" style="color:#f97316;"></i> Calorías: <strong>${clase.calorias} kcal</strong></div>
                </div>
                ${asistenciaInfoHTML}
            `;

            // Click para abrir asistencia
            card.onclick = () => openAttendanceModal(clase.id);

            clasesListEl.appendChild(card);
        });
    };

    // ==========================================
    // CONTROLADOR DE TABS Y LOGOUT
    // ==========================================
    if (tabHoyBtn) {
        tabHoyBtn.onclick = () => {
            currentTab = 'hoy';
            tabHoyBtn.classList.add('active');
            tabHistorialBtn.classList.remove('active');
            renderDashboard();
        };
    }

    if (tabHistorialBtn) {
        tabHistorialBtn.onclick = () => {
            currentTab = 'historial';
            tabHistorialBtn.classList.add('active');
            tabHoyBtn.classList.remove('active');
            renderDashboard();
        };
    }

    if (btnLogout) {
        btnLogout.onclick = () => {
            if (confirm('¿Cerrar sesión de entrenador?')) {
                sessionStorage.clear();
                window.location.href = 'index.html';
            }
        };
    }

    // ==========================================
    // MODAL DE ASISTENCIA Y PERSISTENCIA
    // ==========================================
    const openAttendanceModal = (claseId) => {
        selectedClaseId = claseId;
        renderAttendanceList(claseId);
        modalAttendance.classList.remove('hidden');
    };

    if (btnCloseAttendance) {
        btnCloseAttendance.onclick = () => {
            modalAttendance.classList.add('hidden');
            selectedClaseId = null;
        };
    }

    const renderAttendanceList = (claseId) => {
        const clase = db.clases.find(c => c.id === claseId);
        if (!clase) return;

        // Títulos en el Modal
        if (modalClassTitle) modalClassTitle.innerText = clase.nombre || 'Pasar Asistencia';
        
        const fechaParts = clase.fecha.split('-');
        const dateObj = new Date(fechaParts[0], fechaParts[1] - 1, fechaParts[2]);
        const fechaLegible = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        
        if (modalClassTime) {
            modalClassTime.innerHTML = `<i class="fa-regular fa-calendar"></i> ${fechaLegible} &bull; <i class="fa-regular fa-clock"></i> ${clase.hora} hs`;
        }

        // Renderizar Alumnos
        studentsAttendanceList.innerHTML = '';
        const inscritos = clase.alumnosInscritos || [];
        const asistieron = clase.alumnosAsistieron || [];
        const asistieronEmails = asistieron.map(a => a.correo.trim().toLowerCase());

        if (inscritos.length === 0) {
            studentsAttendanceList.innerHTML = `
                <div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13.5px;">
                    <i class="fa-solid fa-users-slash" style="font-size:28px; margin-bottom:8px; display:block;"></i>
                    No hay alumnos inscritos en esta clase aún.
                </div>
            `;
            btnSaveAttendance.style.display = 'none';
            return;
        }

        btnSaveAttendance.style.display = 'flex';
        btnSaveAttendance.disabled = false;
        btnSaveAttendance.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Guardar Asistencia';
        btnSaveAttendance.style.background = 'var(--primary-gradient)';

        inscritos.forEach((correo, index) => {
            // Buscar perfil del alumno
            const alumno = db.alumnos.find(a => a.correo && a.correo.trim().toLowerCase() === correo.trim().toLowerCase());
            const nombre = alumno ? alumno.nombre : correo;
            const checked = asistieronEmails.includes(correo.trim().toLowerCase()) ? 'checked' : '';

            // Avatar del alumno
            let avatarHtml = `<i class="fa-solid fa-user"></i>`;
            if (alumno && alumno.foto) {
                avatarHtml = `<img src="${alumno.foto}" alt="${nombre}">`;
            }

            const item = document.createElement('div');
            item.className = 'attendance-item';
            item.innerHTML = `
                <div class="student-info-row">
                    <div class="student-avatar">
                        ${avatarHtml}
                    </div>
                    <div class="student-name-email">
                        <h4>${nombre}</h4>
                        <p>${correo}</p>
                    </div>
                </div>
                <label class="switch-container">
                    <input type="checkbox" class="student-switch" data-correo="${correo}" data-nombre="${nombre}" ${checked}>
                    <span class="switch-slider"></span>
                </label>
            `;
            studentsAttendanceList.appendChild(item);
        });
    };

    // Guardar Asistencia en Firebase
    if (btnSaveAttendance) {
        btnSaveAttendance.onclick = () => {
            if (!selectedClaseId) return;

            const switches = document.querySelectorAll('.student-switch');
            let alumnosAsistieron = [];

            switches.forEach(sw => {
                if (sw.checked) {
                    alumnosAsistieron.push({
                        correo: sw.dataset.correo,
                        nombre: sw.dataset.nombre
                    });
                }
            });

            // Animación de Cargando
            btnSaveAttendance.disabled = true;
            btnSaveAttendance.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

            dbRef.collection("clases").doc(selectedClaseId).update({
                alumnosAsistieron: alumnosAsistieron,
                asistenciaGrabada: true
            }).then(() => {
                // Animación de éxito premium
                btnSaveAttendance.style.background = '#10b981'; // Verde esmeralda éxito
                btnSaveAttendance.innerHTML = '<i class="fa-solid fa-circle-check" style="color:white;"></i> ¡Asistencia Guardada!';
                
                setTimeout(() => {
                    modalAttendance.classList.add('hidden');
                    selectedClaseId = null;
                }, 1500);
            }).catch(err => {
                alert("Error al guardar asistencia: " + err);
                btnSaveAttendance.disabled = false;
                btnSaveAttendance.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Guardar Asistencia';
                btnSaveAttendance.style.background = 'var(--primary-gradient)';
            });
        };
    }
});
