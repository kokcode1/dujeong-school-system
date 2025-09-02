// 사용자 데이터 (실제로는 서버에서 관리되어야 함)
const users = {
    'teacher1': { password: 'pass123', type: 'teacher', name: '김선생' },
    'teacher2': { password: 'pass123', type: 'teacher', name: '이선생' },
    'admin': { password: 'admin123', type: 'admin', name: '관리자' }
};

// 신청 데이터 저장
let requests = {
    computerRoom: JSON.parse(localStorage.getItem('computerRoomRequests') || '[]'),
    science: JSON.parse(localStorage.getItem('scienceRequests') || '[]'),
    maintenance: JSON.parse(localStorage.getItem('maintenanceRequests') || '[]'),
    toner: JSON.parse(localStorage.getItem('tonerRequests') || '[]'),
    tabletRouter: JSON.parse(localStorage.getItem('tabletRouterRequests') || '[]')
};

// 태블릿 정보 데이터
let tabletInfo = JSON.parse(localStorage.getItem('tabletInfo') || '{"wifi": "", "password": "", "instructions": ""}');

// 현재 로그인된 사용자
let currentUser = null;

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    // 로그인 폼 이벤트 리스너
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // 저장된 세션 확인
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showUserSection();
    }
    
    updateAdminStats();
});

// 로그인 처리
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const userType = document.getElementById('userType').value;
    
    if (users[username] && users[username].password === password && users[username].type === userType) {
        currentUser = {
            username: username,
            name: users[username].name,
            type: users[username].type
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showUserSection();
    } else {
        alert('로그인 정보가 올바르지 않습니다.');
    }
}

// 사용자 섹션 표시
function showUserSection() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userName').textContent = currentUser.name + '님';
    
    if (currentUser.type === 'teacher') {
        document.getElementById('teacherSection').style.display = 'block';
        document.getElementById('adminSection').style.display = 'none';
    } else if (currentUser.type === 'admin') {
        document.getElementById('adminSection').style.display = 'block';
        document.getElementById('teacherSection').style.display = 'none';
        updateAdminStats();
    }
}

// 로그아웃
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('teacherSection').style.display = 'none';
    document.getElementById('adminSection').style.display = 'none';
    
    // 폼 초기화
    document.getElementById('loginForm').reset();
}

// 페이지 열기 (선생님)
function openPage(page) {
    const content = document.querySelector('main');
    
    switch(page) {
        case 'computer-room':
            showComputerRoomForm();
            break;
        case 'tablet-info':
            showTabletInfo();
            break;
        case 'science-supplies':
            showScienceForm();
            break;
        case 'maintenance':
            showMaintenanceForm();
            break;
        case 'toner':
            showTonerForm();
            break;
    }
}

// 관리자 페이지 열기
function openAdminPage(page) {
    switch(page) {
        case 'computer-room-manage':
            showRequestManagement('computerRoom', '컴퓨터실 사용 신청');
            break;
        case 'tablet-manage':
            showTabletManagement();
            break;
        case 'science-manage':
            showRequestManagement('science', '과학실 준비물 신청');
            break;
        case 'maintenance-manage':
            showRequestManagement('maintenance', '컴퓨터 유지보수 신청');
            break;
        case 'toner-manage':
            showRequestManagement('toner', '토너 신청');
            break;
    }
}

// 기본 학년 배정 설정
const defaultAssignments = {
    computer: {
        '월': '3',
        '화': '4', 
        '수': ['1', '2'],
        '목': '5',
        '금': '6'
    },
    router: {
        '월': '3',
        '화': '3',
        '수': '3',
        '목': '4',
        '금': '4'
    }
};

let currentFacility = 'computer'; // 'computer' 또는 'router'
let currentWeekStart = null;

// 컴퓨터실 신청 폼 - 주간 시간표 형태
function showComputerRoomForm() {
    const content = document.querySelector('main');
    
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="schedule-container">
            <h2 style="text-align: center; color: #2d3748; margin-bottom: 1.5rem; font-size: 1.75rem; font-weight: 600;">시설 사용 신청</h2>
            
            <div class="facility-tabs">
                <div class="facility-tab active" onclick="switchFacility('computer')">
                    컴퓨터실
                </div>
                <div class="facility-tab" onclick="switchFacility('router')">
                    공유기 (늘봄교실3)
                </div>
            </div>
            
            <div class="date-selector">
                <label for="weekSelector">주차 선택:</label>
                <input type="week" id="weekSelector" onchange="updateWeeklySchedule()">
            </div>
            
            <div class="schedule-legend">
                <div class="legend-item">
                    <div class="legend-color legend-available"></div>
                    <span>예약 가능</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-occupied"></div>
                    <span>예약됨</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-mine"></div>
                    <span>내 예약</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-default"></div>
                    <span>기본 배정</span>
                </div>
            </div>
            
            <div id="weeklyScheduleContainer">
                <!-- 주간 시간표가 여기에 동적으로 생성됩니다 -->
            </div>
        </div>
        
        <!-- 예약 확인 모달 -->
        <div id="reservationModal" class="reservation-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTitle">시설 예약</h3>
                    <p id="modalSubtitle">선택한 시간에 예약하시겠습니까?</p>
                </div>
                <div class="modal-form">
                    <div class="form-group">
                        <label for="modalPurpose">사용 목적:</label>
                        <textarea id="modalPurpose" rows="3" placeholder="사용 목적을 입력해주세요" style="width: 100%; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px; font-family: inherit; resize: vertical;" required></textarea>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="modal-btn secondary" onclick="closeReservationModal()">취소</button>
                    <button class="modal-btn primary" onclick="confirmReservation()">예약하기</button>
                </div>
            </div>
        </div>
    `;
    
    // 현재 주차로 초기화
    initializeWeekSelector();
    updateWeeklySchedule();
}

// 태블릿 정보 보기
function showTabletInfo() {
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>태블릿 공유기 정보</h2>
            <div class="form-group">
                <label>Wi-Fi 이름:</label>
                <p style="padding: 12px; background: #f7fafc; border-radius: 5px; margin-top: 5px;">${tabletInfo.wifi || '정보가 없습니다.'}</p>
            </div>
            <div class="form-group">
                <label>Wi-Fi 비밀번호:</label>
                <p style="padding: 12px; background: #f7fafc; border-radius: 5px; margin-top: 5px;">${tabletInfo.password || '정보가 없습니다.'}</p>
            </div>
            <div class="form-group">
                <label>사용 안내:</label>
                <p style="padding: 12px; background: #f7fafc; border-radius: 5px; margin-top: 5px; white-space: pre-wrap;">${tabletInfo.instructions || '안내사항이 없습니다.'}</p>
            </div>
        </div>
    `;
}

// 과학실 준비물 신청 폼
function showScienceForm() {
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>과학실 준비물 신청</h2>
            <form id="scienceForm">
                <div class="form-group">
                    <label for="requestDate">신청일:</label>
                    <input type="date" id="requestDate" name="requestDate" required>
                </div>
                <div class="form-group">
                    <label for="needDate">필요일:</label>
                    <input type="date" id="needDate" name="needDate" required>
                </div>
                <div class="form-group">
                    <label for="items">준비물 목록:</label>
                    <textarea id="items" name="items" rows="4" placeholder="필요한 준비물을 자세히 적어주세요" required></textarea>
                </div>
                <div class="form-group">
                    <label for="quantity">수량:</label>
                    <input type="number" id="quantity" name="quantity" min="1" required>
                </div>
                <div class="form-group">
                    <label for="purpose">사용 목적:</label>
                    <textarea id="purpose" name="purpose" rows="3" required></textarea>
                </div>
                <button type="submit">신청하기</button>
            </form>
        </div>
    `;
    
    document.getElementById('scienceForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitRequest('science', {
            requestDate: document.getElementById('requestDate').value,
            needDate: document.getElementById('needDate').value,
            items: document.getElementById('items').value,
            quantity: document.getElementById('quantity').value,
            purpose: document.getElementById('purpose').value
        });
    });
    
    document.getElementById('requestDate').value = new Date().toISOString().split('T')[0];
}

// 유지보수 신청 폼
function showMaintenanceForm() {
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>컴퓨터 유지보수 신청</h2>
            <form id="maintenanceForm">
                <div class="form-group">
                    <label for="requestDate">신청일:</label>
                    <input type="date" id="requestDate" name="requestDate" required>
                </div>
                <div class="form-group">
                    <label for="location">위치:</label>
                    <input type="text" id="location" name="location" placeholder="예: 3층 컴퓨터실" required>
                </div>
                <div class="form-group">
                    <label for="problem">문제점:</label>
                    <textarea id="problem" name="problem" rows="4" placeholder="어떤 문제가 발생했는지 자세히 설명해주세요" required></textarea>
                </div>
                <div class="form-group">
                    <label for="urgency">긴급도:</label>
                    <select id="urgency" name="urgency" required>
                        <option value="">선택하세요</option>
                        <option value="낮음">낮음</option>
                        <option value="보통">보통</option>
                        <option value="높음">높음</option>
                        <option value="긴급">긴급</option>
                    </select>
                </div>
                <button type="submit">신청하기</button>
            </form>
        </div>
    `;
    
    document.getElementById('maintenanceForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitRequest('maintenance', {
            requestDate: document.getElementById('requestDate').value,
            location: document.getElementById('location').value,
            problem: document.getElementById('problem').value,
            urgency: document.getElementById('urgency').value
        });
    });
    
    document.getElementById('requestDate').value = new Date().toISOString().split('T')[0];
}

// 토너 신청 폼
function showTonerForm() {
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>토너 신청</h2>
            <form id="tonerForm">
                <div class="form-group">
                    <label for="requestDate">신청일:</label>
                    <input type="date" id="requestDate" name="requestDate" required>
                </div>
                <div class="form-group">
                    <label for="printerModel">프린터 모델:</label>
                    <input type="text" id="printerModel" name="printerModel" placeholder="예: HP LaserJet P1102" required>
                </div>
                <div class="form-group">
                    <label for="tonerType">토너 종류:</label>
                    <select id="tonerType" name="tonerType" required>
                        <option value="">선택하세요</option>
                        <option value="검정">검정</option>
                        <option value="컬러">컬러</option>
                        <option value="검정+컬러">검정+컬러</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="quantity">수량:</label>
                    <input type="number" id="quantity" name="quantity" min="1" required>
                </div>
                <div class="form-group">
                    <label for="location">설치 위치:</label>
                    <input type="text" id="location" name="location" placeholder="예: 2층 교무실" required>
                </div>
                <button type="submit">신청하기</button>
            </form>
        </div>
    `;
    
    document.getElementById('tonerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitRequest('toner', {
            requestDate: document.getElementById('requestDate').value,
            printerModel: document.getElementById('printerModel').value,
            tonerType: document.getElementById('tonerType').value,
            quantity: document.getElementById('quantity').value,
            location: document.getElementById('location').value
        });
    });
    
    document.getElementById('requestDate').value = new Date().toISOString().split('T')[0];
}

// 신청 제출
function submitRequest(type, data) {
    const request = {
        id: Date.now(),
        requester: currentUser.name,
        status: 'pending',
        submittedAt: new Date().toLocaleString('ko-KR'),
        ...data
    };
    
    requests[type].push(request);
    localStorage.setItem(type + 'Requests', JSON.stringify(requests[type]));
    
    alert('신청이 완료되었습니다.');
    updateAdminStats();
    goBack();
}

// 신청 관리 화면
function showRequestManagement(type, title) {
    const content = document.querySelector('main');
    const requestList = requests[type] || [];
    
    let tableRows = '';
    requestList.forEach(request => {
        const statusClass = `status-${request.status}`;
        const statusText = request.status === 'pending' ? '대기중' : 
                          request.status === 'approved' ? '승인' : '거절';
        
        tableRows += `
            <tr>
                <td>${request.id}</td>
                <td>${request.requester}</td>
                <td>${request.submittedAt}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    ${request.status === 'pending' ? `
                        <button class="action-btn approve-btn" onclick="updateRequestStatus('${type}', ${request.id}, 'approved')">승인</button>
                        <button class="action-btn reject-btn" onclick="updateRequestStatus('${type}', ${request.id}, 'rejected')">거절</button>
                    ` : '완료'}
                </td>
            </tr>
        `;
    });
    
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <h2>${title} 관리</h2>
        <table class="requests-table">
            <thead>
                <tr>
                    <th>신청번호</th>
                    <th>신청자</th>
                    <th>신청일시</th>
                    <th>상태</th>
                    <th>액션</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 40px;">신청이 없습니다.</td></tr>'}
            </tbody>
        </table>
    `;
}

// 태블릿 관리 화면
function showTabletManagement() {
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>태블릿 공유기 정보 관리</h2>
            <form id="tabletManageForm">
                <div class="form-group">
                    <label for="wifi">Wi-Fi 이름:</label>
                    <input type="text" id="wifi" name="wifi" value="${tabletInfo.wifi}">
                </div>
                <div class="form-group">
                    <label for="password">Wi-Fi 비밀번호:</label>
                    <input type="text" id="password" name="password" value="${tabletInfo.password}">
                </div>
                <div class="form-group">
                    <label for="instructions">사용 안내:</label>
                    <textarea id="instructions" name="instructions" rows="6">${tabletInfo.instructions}</textarea>
                </div>
                <button type="submit">저장하기</button>
            </form>
        </div>
    `;
    
    document.getElementById('tabletManageForm').addEventListener('submit', function(e) {
        e.preventDefault();
        tabletInfo = {
            wifi: document.getElementById('wifi').value,
            password: document.getElementById('password').value,
            instructions: document.getElementById('instructions').value
        };
        localStorage.setItem('tabletInfo', JSON.stringify(tabletInfo));
        alert('정보가 저장되었습니다.');
    });
}

// 신청 상태 업데이트
function updateRequestStatus(type, id, status) {
    const requestIndex = requests[type].findIndex(req => req.id === id);
    if (requestIndex !== -1) {
        requests[type][requestIndex].status = status;
        requests[type][requestIndex].processedAt = new Date().toLocaleString('ko-KR');
        localStorage.setItem(type + 'Requests', JSON.stringify(requests[type]));
        
        alert(`신청이 ${status === 'approved' ? '승인' : '거절'}되었습니다.`);
        updateAdminStats();
        showRequestManagement(type, getTypeTitle(type));
    }
}

// 타입별 제목 가져오기
function getTypeTitle(type) {
    const titles = {
        computerRoom: '컴퓨터실 사용 신청',
        science: '과학실 준비물 신청',
        maintenance: '컴퓨터 유지보수 신청',
        toner: '토너 신청'
    };
    return titles[type] || '';
}

// 관리자 통계 업데이트
function updateAdminStats() {
    if (currentUser && currentUser.type === 'admin') {
        const today = new Date().toDateString();
        let totalRequests = 0;
        let pendingRequests = 0;
        let todayProcessed = 0;
        
        // 모든 요청 타입 포함 (공유기 포함)
        Object.values(requests).forEach(requestList => {
            if (Array.isArray(requestList)) {
                totalRequests += requestList.length;
                requestList.forEach(request => {
                    if (request.status === 'pending') {
                        pendingRequests++;
                    }
                    if (request.processedAt && new Date(request.processedAt).toDateString() === today) {
                        todayProcessed++;
                    }
                });
            }
        });
        
        const pendingEl = document.getElementById('pendingRequests');
        const todayEl = document.getElementById('todayProcessed');
        const totalEl = document.getElementById('totalRequests');
        
        if (pendingEl) pendingEl.textContent = pendingRequests;
        if (todayEl) todayEl.textContent = todayProcessed;
        if (totalEl) totalEl.textContent = totalRequests;
    }
}

// 시설 전환
function switchFacility(facility) {
    currentFacility = facility;
    
    // 탭 활성화 상태 변경
    document.querySelectorAll('.facility-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 시간표 업데이트
    updateWeeklySchedule();
}

// 주차 선택기 초기화
function initializeWeekSelector() {
    const weekSelector = document.getElementById('weekSelector');
    const today = new Date();
    
    // 이번 주의 월요일 구하기
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    
    // ISO 주차 형식으로 변환 (YYYY-Www)
    const year = monday.getFullYear();
    const weekNumber = getWeekNumber(monday);
    weekSelector.value = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    
    currentWeekStart = new Date(monday);
}

// 주차 번호 계산
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

// 주간 시간표 업데이트
function updateWeeklySchedule() {
    const weekSelector = document.getElementById('weekSelector');
    if (!weekSelector.value) return;
    
    // 선택된 주의 월요일 계산
    const [year, week] = weekSelector.value.split('-W');
    const monday = getDateFromWeek(parseInt(year), parseInt(week));
    currentWeekStart = monday;
    
    const container = document.getElementById('weeklyScheduleContainer');
    container.innerHTML = generateWeeklyScheduleTable();
}

// 주차로부터 날짜 계산
function getDateFromWeek(year, week) {
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - jan4.getDay() + 1 + (week - 1) * 7);
    return monday;
}

// 주간 시간표 테이블 생성
function generateWeeklyScheduleTable() {
    const periods = [
        { name: '1교시', time: '09:00-09:40' },
        { name: '2교시', time: '09:50-10:30' },
        { name: '3교시', time: '10:40-11:20' },
        { name: '4교시', time: '11:30-12:10' },
        { name: '5교시', time: '13:10-13:50' },
        { name: '6교시', time: '14:00-14:40' }
    ];
    
    const weekdays = ['월', '화', '수', '목', '금'];
    
    let tableHTML = `
        <table class="weekly-schedule-table">
            <thead>
                <tr>
                    <th class="period-header">교시</th>
    `;
    
    // 요일 헤더
    weekdays.forEach((day, index) => {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + index);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        tableHTML += `<th>${day}<br><small>${dateStr}</small></th>`;
    });
    
    tableHTML += `
                </tr>
            </thead>
            <tbody>
    `;
    
    // 교시별 행 생성
    periods.forEach((period, periodIndex) => {
        tableHTML += `
            <tr>
                <th class="period-header">${period.name}<br><small>${period.time}</small></th>
        `;
        
        weekdays.forEach((day, dayIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            const dateStr = date.toISOString().split('T')[0];
            
            const cellStatus = getWeeklyCellStatus(day, period.name, dateStr);
            const cellClass = cellStatus.status;
            const cellData = cellStatus.grade ? `data-grade="${cellStatus.grade}"` : '';
            const onClick = cellStatus.clickable ? 
                `onclick="handleWeeklyCellClick('${dateStr}', '${period.name}', '${period.time}', '${day}', '${cellClass}')"` : '';
            
            tableHTML += `
                <td>
                    <button class="schedule-cell ${cellClass}" ${cellData} ${onClick}>
                        ${cellStatus.content || ''}
                    </button>
                </td>
            `;
        });
        
        tableHTML += `</tr>`;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    return tableHTML;
}

// 주간 시간표 셀 상태 확인
function getWeeklyCellStatus(day, period, dateStr) {
    const facilityType = currentFacility === 'computer' ? 'computerRoom' : 'router';
    const facilityRequests = currentFacility === 'computer' ? 
        (requests.computerRoom || []) : 
        (requests.tabletRouter || []);
    
    // 기본 배정 확인
    const defaultGrades = defaultAssignments[currentFacility][day];
    const isDefaultAssigned = Array.isArray(defaultGrades) ? 
        defaultGrades.includes(period.charAt(0)) : 
        defaultGrades === period.charAt(0);
    
    if (isDefaultAssigned) {
        const gradeText = Array.isArray(defaultGrades) ? defaultGrades.join(',') : defaultGrades;
        return { 
            status: 'default-assigned', 
            grade: gradeText,
            content: `${gradeText}학년`,
            clickable: false 
        };
    }
    
    // 예약 상태 확인
    const existingReservation = facilityRequests.find(req => 
        req.useDate === dateStr && 
        req.useTime === period && 
        (req.status === 'approved' || req.status === 'pending')
    );
    
    if (existingReservation) {
        if (existingReservation.requester === currentUser.name) {
            return { 
                status: 'my-reservation', 
                content: '내 예약',
                clickable: true 
            };
        } else {
            return { 
                status: 'occupied', 
                content: '예약됨',
                clickable: false 
            };
        }
    }
    
    return { 
        status: 'available', 
        content: '예약가능',
        clickable: true 
    };
}

// 주간 시간표 셀 클릭 처리
function handleWeeklyCellClick(date, period, time, day, currentStatus) {
    if (currentStatus === 'my-reservation') {
        // 내 예약 취소 확인
        if (confirm(`${day}요일 ${period} (${time}) 예약을 취소하시겠습니까?`)) {
            cancelWeeklyReservation(date, period);
        }
        return;
    }
    
    // 새 예약
    selectedSlot = { date, period, time, day };
    
    const facilityName = currentFacility === 'computer' ? '컴퓨터실' : '공유기 (늘봄교실3)';
    document.getElementById('modalTitle').textContent = `${facilityName} ${period} 예약`;
    document.getElementById('modalSubtitle').textContent = `${date} (${day}요일) ${time}에 ${facilityName}을 예약하시겠습니까?`;
    document.getElementById('modalPurpose').value = '';
    
    const modal = document.getElementById('reservationModal');
    modal.classList.add('active');
}

// 주간 예약 취소
function cancelWeeklyReservation(date, period) {
    const facilityType = currentFacility === 'computer' ? 'computerRoom' : 'tabletRouter';
    const storageKey = currentFacility === 'computer' ? 'computerRoomRequests' : 'tabletRouterRequests';
    const facilityRequests = currentFacility === 'computer' ? 
        (requests.computerRoom || []) : 
        (requests.tabletRouter || []);
    
    const reservationIndex = facilityRequests.findIndex(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.requester === currentUser.name
    );
    
    if (reservationIndex !== -1) {
        facilityRequests.splice(reservationIndex, 1);
        localStorage.setItem(storageKey, JSON.stringify(facilityRequests));
        
        if (currentFacility === 'computer') {
            requests.computerRoom = facilityRequests;
        } else {
            requests.tabletRouter = facilityRequests;
        }
        
        alert('예약이 취소되었습니다.');
        updateWeeklySchedule();
        updateAdminStats();
    }
}

// 시간표 업데이트 (기존 함수 - 호환성을 위해 유지)
function updateSchedule() {
    const selectedDate = document.getElementById('scheduleDate').value;
    const scheduleGrid = document.getElementById('scheduleGrid');
    
    const timeSlots = [
        { period: '1교시', time: '09:00-09:40' },
        { period: '2교시', time: '09:50-10:30' },
        { period: '3교시', time: '10:40-11:20' },
        { period: '4교시', time: '11:30-12:10' },
        { period: '5교시', time: '13:10-13:50' },
        { period: '6교시', time: '14:00-14:40' }
    ];
    
    let gridHTML = '';
    
    timeSlots.forEach(slot => {
        const slotStatus = getSlotStatus(selectedDate, slot.period);
        const statusClass = slotStatus.status;
        const isClickable = statusClass === 'available' || statusClass === 'my-reservation';
        const onClick = isClickable ? `onclick="handleSlotClick('${selectedDate}', '${slot.period}', '${slot.time}', '${statusClass}')"` : '';
        
        gridHTML += `
            <div class="time-slot ${statusClass}" ${onClick}>
                <h4>${slot.period}</h4>
                <p>${slot.time}</p>
                ${slotStatus.requester ? `<div style="position: absolute; bottom: 0.5rem; left: 50%; transform: translateX(-50%); font-size: 0.7rem; opacity: 0.7; z-index: 15;">${slotStatus.requester}</div>` : ''}
            </div>
        `;
    });
    
    scheduleGrid.innerHTML = gridHTML;
}

// 시간대별 예약 상태 확인
function getSlotStatus(date, period) {
    const computerRoomRequests = requests.computerRoom || [];
    
    // 선택된 날짜와 시간에 해당하는 승인된 예약 찾기
    const existingReservation = computerRoomRequests.find(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.status === 'approved'
    );
    
    if (existingReservation) {
        // 내 예약인지 확인
        if (existingReservation.requester === currentUser.name) {
            return { status: 'my-reservation', requester: existingReservation.requester };
        } else {
            return { status: 'occupied', requester: existingReservation.requester };
        }
    }
    
    // 대기중인 예약이 있는지 확인
    const pendingReservation = computerRoomRequests.find(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.status === 'pending'
    );
    
    if (pendingReservation) {
        if (pendingReservation.requester === currentUser.name) {
            return { status: 'my-reservation', requester: pendingReservation.requester };
        } else {
            return { status: 'occupied', requester: pendingReservation.requester };
        }
    }
    
    return { status: 'available' };
}

// 시간 슬롯 클릭 처리
let selectedSlot = null;

function handleSlotClick(date, period, time, currentStatus) {
    if (currentStatus === 'my-reservation') {
        // 내 예약 취소 확인
        if (confirm(`${period} (${time}) 예약을 취소하시겠습니까?`)) {
            cancelReservation(date, period);
        }
        return;
    }
    
    // 새 예약
    selectedSlot = { date, period, time };
    
    document.getElementById('modalTitle').textContent = `${period} 예약`;
    document.getElementById('modalSubtitle').textContent = `${date} ${time}에 컴퓨터실을 예약하시겠습니까?`;
    document.getElementById('modalPurpose').value = '';
    
    const modal = document.getElementById('reservationModal');
    modal.classList.add('active');
}

// 예약 취소
function cancelReservation(date, period) {
    const computerRoomRequests = requests.computerRoom || [];
    const reservationIndex = computerRoomRequests.findIndex(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.requester === currentUser.name
    );
    
    if (reservationIndex !== -1) {
        computerRoomRequests.splice(reservationIndex, 1);
        localStorage.setItem('computerRoomRequests', JSON.stringify(computerRoomRequests));
        requests.computerRoom = computerRoomRequests;
        
        alert('예약이 취소되었습니다.');
        updateSchedule();
        updateAdminStats();
    }
}

// 예약 확인 모달 닫기
function closeReservationModal() {
    const modal = document.getElementById('reservationModal');
    modal.classList.remove('active');
    selectedSlot = null;
}

// 예약 확정
function confirmReservation() {
    const purpose = document.getElementById('modalPurpose').value.trim();
    
    if (!purpose) {
        alert('사용 목적을 입력해주세요.');
        return;
    }
    
    if (!selectedSlot) {
        alert('선택된 시간이 없습니다.');
        return;
    }
    
    // 시설별 저장 키 결정
    const facilityType = currentFacility === 'computer' ? 'computerRoom' : 'tabletRouter';
    const storageKey = currentFacility === 'computer' ? 'computerRoomRequests' : 'tabletRouterRequests';
    
    // 예약 데이터 생성
    const reservation = {
        id: Date.now(),
        requester: currentUser.name,
        status: 'pending',
        submittedAt: new Date().toLocaleString('ko-KR'),
        requestDate: new Date().toISOString().split('T')[0],
        useDate: selectedSlot.date,
        useTime: selectedSlot.period,
        purpose: purpose,
        facility: currentFacility // 시설 구분 추가
    };
    
    // 시설별 예약 배열 초기화 및 추가
    if (currentFacility === 'computer') {
        if (!requests.computerRoom) {
            requests.computerRoom = [];
        }
        requests.computerRoom.push(reservation);
        localStorage.setItem('computerRoomRequests', JSON.stringify(requests.computerRoom));
    } else {
        if (!requests.tabletRouter) {
            requests.tabletRouter = [];
        }
        requests.tabletRouter.push(reservation);
        localStorage.setItem('tabletRouterRequests', JSON.stringify(requests.tabletRouter));
    }
    
    const facilityName = currentFacility === 'computer' ? '컴퓨터실' : '공유기 (늘봄교실3)';
    alert(`${facilityName} 예약 신청이 완료되었습니다. 관리자 승인 후 확정됩니다.`);
    
    // 모달 닫기 및 스케줄 업데이트
    closeReservationModal();
    if (document.getElementById('weeklyScheduleContainer')) {
        updateWeeklySchedule();
    } else {
        updateSchedule();
    }
    updateAdminStats();
}

// 뒤로가기
function goBack() {
    location.reload();
}