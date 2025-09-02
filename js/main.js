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
    toner: JSON.parse(localStorage.getItem('tonerRequests') || '[]')
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

// 컴퓨터실 신청 폼 - 시간표 형태
function showComputerRoomForm() {
    const content = document.querySelector('main');
    const today = new Date().toISOString().split('T')[0];
    
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="schedule-container">
            <h2 style="text-align: center; color: #2d3748; margin-bottom: 1.5rem; font-size: 1.75rem; font-weight: 600;">컴퓨터실 사용 신청</h2>
            
            <div class="date-selector">
                <label for="scheduleDate">사용 예정일 선택:</label>
                <input type="date" id="scheduleDate" value="${today}" min="${today}" onchange="updateSchedule()">
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
            </div>
            
            <div class="schedule-grid" id="scheduleGrid">
                <!-- 시간표가 여기에 동적으로 생성됩니다 -->
            </div>
        </div>
        
        <!-- 예약 확인 모달 -->
        <div id="reservationModal" class="reservation-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTitle">컴퓨터실 예약</h3>
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
    
    // 초기 스케줄 로드
    updateSchedule();
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
        
        Object.values(requests).forEach(requestList => {
            totalRequests += requestList.length;
            requestList.forEach(request => {
                if (request.status === 'pending') {
                    pendingRequests++;
                }
                if (request.processedAt && new Date(request.processedAt).toDateString() === today) {
                    todayProcessed++;
                }
            });
        });
        
        const pendingEl = document.getElementById('pendingRequests');
        const todayEl = document.getElementById('todayProcessed');
        const totalEl = document.getElementById('totalRequests');
        
        if (pendingEl) pendingEl.textContent = pendingRequests;
        if (todayEl) todayEl.textContent = todayProcessed;
        if (totalEl) totalEl.textContent = totalRequests;
    }
}

// 시간표 업데이트
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
    
    // 예약 데이터 생성
    const reservation = {
        id: Date.now(),
        requester: currentUser.name,
        status: 'pending',
        submittedAt: new Date().toLocaleString('ko-KR'),
        requestDate: new Date().toISOString().split('T')[0],
        useDate: selectedSlot.date,
        useTime: selectedSlot.period,
        purpose: purpose
    };
    
    // 예약 추가
    if (!requests.computerRoom) {
        requests.computerRoom = [];
    }
    requests.computerRoom.push(reservation);
    localStorage.setItem('computerRoomRequests', JSON.stringify(requests.computerRoom));
    
    alert('예약 신청이 완료되었습니다. 관리자 승인 후 확정됩니다.');
    
    // 모달 닫기 및 스케줄 업데이트
    closeReservationModal();
    updateSchedule();
    updateAdminStats();
}

// 뒤로가기
function goBack() {
    location.reload();
}