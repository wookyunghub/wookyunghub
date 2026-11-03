(async()=>{
  const $ = id => document.getElementById(id);
  let siteData = {};
  let orgData = {};

  function resolveAdminImg(u){
    if(!u) return '';
    if(u.startsWith('http://')||u.startsWith('https://')||u.startsWith('data:')||u.startsWith('/')) return u;
    if(u.startsWith('../')) return u;
    return '../' + u;
  }

  // 1. 서브 탭 전환 로직
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-tab-content').forEach(c => c.hidden = true);
      btn.classList.add('active');
      const targetContent = $(btn.dataset.tab);
      if(targetContent) targetContent.hidden = false;
    };
  });

  // 2. 데이터 로드 (site 및 organization)
  try {
    const [resSite, resOrg] = await Promise.all([
      fetch('../api/admin/data?name=site', {credentials:'same-origin', cache:'no-store'}),
      fetch('../api/admin/data?name=organization', {credentials:'same-origin', cache:'no-store'})
    ]);
    if(resSite.ok) siteData = await resSite.json();
    if(resOrg.ok) orgData = await resOrg.json();
  } catch(e){}

  if(!siteData.organization_name){
    try {
      const r = await fetch('../data/site.json', {cache:'no-store'});
      if(r.ok) siteData = await r.json();
    } catch(e){}
  }
  if(!orgData.basic){
    try {
      const r = await fetch('../data/organization.json', {cache:'no-store'});
      if(r.ok) orgData = await r.json();
    } catch(e){}
  }

  orgData.basic = orgData.basic || {};
  const basic = orgData.basic;

  // 3. 필드 매핑
  const siteFields = {
    's-org': 'organization_name',
    's-period': 'latest_period',
    's-parent': 'parent_organization',
    's-branch': 'branch_name',
    's-title': 'site_title',
    's-public': 'public_url',
    's-map': 'map_url',
    's-logo': 'logo_image',
    's-building': 'building_image'
  };

  const basicFields = {
    'b-chairman-name': 'chairman_name',
    'b-phone': 'phone',
    'b-address': 'address',
    'b-members-total': 'members_total',
    'b-members-male': 'members_male',
    'b-members-female': 'members_female',
    'b-unique-number': 'unique_number',
    'b-registered-date': 'registered_date',
    'b-capacity': 'facility_capacity',
    'b-build-date': 'build_date',
    'b-structure': 'structure',
    'b-site-area': 'site_area',
    'b-site-pyeong': 'site_area_pyeong',
    'b-building-area': 'building_area',
    'b-building-pyeong': 'building_area_pyeong',
    'b-rooms': 'rooms',
    'b-restrooms': 'restrooms',
    'b-kitchen': 'kitchen',
    'b-sub-rooms': 'sub_rooms',
    'b-heating': 'heating',
    'b-convenience': 'convenience_facilities',
    'b-property-owner': 'property_owner',
    'b-building-ledger': 'building_ledger',
    // 원본 파일 필드들
    'b-card-file': 'card_file',
    'b-floorplan-file': 'floorplan_file',
    'b-chairman-cert': 'chairman_cert',
    'b-unique-number-cert': 'unique_number_cert',
    'b-facility-cert': 'facility_cert'
  };

  // 초기 값 바인딩
  for(const [id, key] of Object.entries(siteFields)){
    const def = key==='logo_image'?'assets/img/logo.png':(key==='building_image'?'assets/img/building.jpg':'');
    if($(id)) $(id).value = siteData[key] !== undefined ? siteData[key] : def;
  }
  for(const [id, key] of Object.entries(basicFields)){
    let def = '';
    if(key === 'card_file') def = 'assets/docs/book1/p005.webp';
    else if(key === 'floorplan_file') def = 'assets/img/floorplan-book1-p28.webp';
    else if(key === 'chairman_cert') def = 'assets/img/certificates/cert_chairman_registration.webp';
    else if(key === 'unique_number_cert') def = 'assets/img/certificates/cert_unique_number.webp';
    else if(key === 'facility_cert') def = 'assets/img/certificates/cert_facility_registration.webp';

    if($(id)) $(id).value = basic[key] !== undefined ? basic[key] : def;
  }

  // 4. 미리보기 및 바로보기 링크 동기화
  function updatePreviews(){
    // 로고 & 건물사진
    if($('s-logo-preview')) $('s-logo-preview').src = resolveAdminImg(($('s-logo') && $('s-logo').value.trim()) || 'assets/img/logo.png');
    if($('s-building-preview')) $('s-building-preview').src = resolveAdminImg(($('s-building') && $('s-building').value.trim()) || 'assets/img/building.jpg');

    // 카드 원본
    const cardVal = ($('b-card-file') && $('b-card-file').value.trim()) || 'assets/docs/book1/p005.webp';
    if($('b-card-file-preview')) $('b-card-file-preview').src = resolveAdminImg(cardVal);
    if($('b-card-file-link')) $('b-card-file-link').href = resolveAdminImg(cardVal);

    // 평면도 원본
    const fpVal = ($('b-floorplan-file') && $('b-floorplan-file').value.trim()) || 'assets/img/floorplan-book1-p28.webp';
    if($('b-floorplan-file-preview')) $('b-floorplan-file-preview').src = resolveAdminImg(fpVal);
    if($('b-floorplan-file-link')) $('b-floorplan-file-link').href = resolveAdminImg(fpVal);

    // 회장등록증
    const cmVal = ($('b-chairman-cert') && $('b-chairman-cert').value.trim()) || 'assets/img/certificates/cert_chairman_registration.webp';
    if($('b-chairman-cert-preview')) $('b-chairman-cert-preview').src = resolveAdminImg(cmVal);
    if($('b-chairman-cert-link')) $('b-chairman-cert-link').href = resolveAdminImg(cmVal);

    // 고유번호증
    const uqVal = ($('b-unique-number-cert') && $('b-unique-number-cert').value.trim()) || 'assets/img/certificates/cert_unique_number.webp';
    if($('b-unique-cert-preview')) $('b-unique-cert-preview').src = resolveAdminImg(uqVal);
    if($('b-unique-cert-link')) $('b-unique-cert-link').href = resolveAdminImg(uqVal);

    // 신고확인증
    const fcVal = ($('b-facility-cert') && $('b-facility-cert').value.trim()) || 'assets/img/certificates/cert_facility_registration.webp';
    if($('b-facility-cert-preview')) $('b-facility-cert-preview').src = resolveAdminImg(fcVal);
    if($('b-facility-cert-link')) $('b-facility-cert-link').href = resolveAdminImg(fcVal);
  }

  updatePreviews();

  // 입력 변경 시 미리보기 동기화
  const fileInputsToWatch = ['s-logo','s-building','b-card-file','b-floorplan-file','b-chairman-cert','b-unique-number-cert','b-facility-cert'];
  fileInputsToWatch.forEach(id => {
    if($(id)) $(id).oninput = updatePreviews;
  });

  // 5. 파일 선택 및 업로드 핸들러
  async function handleFileSelect(fileInput, textInput, previewImg, linkEl){
    const file = fileInput.files && fileInput.files[0];
    if(!file) return;
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const fd = new FormData();
    fd.append('kind', isPdf ? 'documents' : 'photos');
    fd.append('attachment_role', isPdf ? 'document' : 'photo');
    fd.append('public', 'true');
    fd.append('date', new Date().toISOString().slice(0, 10));
    fd.append('title', file.name);
    fd.append('file', file, file.name);

    try {
      $('s-msg').textContent = '파일 업로드 중...';
      const res = await fetch('../api/admin/upload', {method:'POST', credentials:'same-origin', body:fd});
      const result = await res.json();
      if(res.ok && result.item && result.item.path){
        const mediaPath = 'media/' + result.item.path;
        textInput.value = mediaPath;
        if(previewImg && !isPdf) previewImg.src = resolveAdminImg(mediaPath);
        if(linkEl) linkEl.href = resolveAdminImg(mediaPath);
        $('s-msg').textContent = '파일이 업로드되었습니다. [기본 설정 저장] 버튼을 눌러 설정을 반영해 주세요.';
      } else {
        const reader = new FileReader();
        reader.onload = e => {
          if(previewImg && !isPdf) previewImg.src = e.target.result;
          if(linkEl) linkEl.href = e.target.result;
        };
        reader.readAsDataURL(file);
        $('s-msg').textContent = '파일이 선택되었습니다.';
      }
    } catch(err){
      const reader = new FileReader();
      reader.onload = e => {
        if(previewImg && !isPdf) previewImg.src = e.target.result;
        if(linkEl) linkEl.href = e.target.result;
      };
      reader.readAsDataURL(file);
      $('s-msg').textContent = '파일이 선택되었습니다.';
    }
  }

  // 파일 업로드 이벤트 연결
  if($('s-logo-file')) $('s-logo-file').onchange = () => handleFileSelect($('s-logo-file'), $('s-logo'), $('s-logo-preview'));
  if($('s-building-file')) $('s-building-file').onchange = () => handleFileSelect($('s-building-file'), $('s-building'), $('s-building-preview'));
  if($('b-card-file-input')) $('b-card-file-input').onchange = () => handleFileSelect($('b-card-file-input'), $('b-card-file'), $('b-card-file-preview'), $('b-card-file-link'));
  if($('b-floorplan-file-input')) $('b-floorplan-file-input').onchange = () => handleFileSelect($('b-floorplan-file-input'), $('b-floorplan-file'), $('b-floorplan-file-preview'), $('b-floorplan-file-link'));
  if($('b-chairman-cert-input')) $('b-chairman-cert-input').onchange = () => handleFileSelect($('b-chairman-cert-input'), $('b-chairman-cert'), $('b-chairman-cert-preview'), $('b-chairman-cert-link'));
  if($('b-unique-cert-input')) $('b-unique-cert-input').onchange = () => handleFileSelect($('b-unique-cert-input'), $('b-unique-number-cert'), $('b-unique-cert-preview'), $('b-unique-cert-link'));
  if($('b-facility-cert-input')) $('b-facility-cert-input').onchange = () => handleFileSelect($('b-facility-cert-input'), $('b-facility-cert'), $('b-facility-cert-preview'), $('b-facility-cert-link'));

  // 6. 기본 설정 저장
  $('s-save').onclick = async () => {
    const orgName = $('s-org').value.trim();
    if(!orgName){
      $('s-msg').textContent = '조직명을 입력해 주세요.';
      return;
    }
    $('s-save').disabled = true;
    $('s-msg').textContent = '저장 중...';

    try {
      // 1) siteData 업데이트
      const updatedSite = {...siteData};
      for(const [id, key] of Object.entries(siteFields)){
        if($(id)) updatedSite[key] = $(id).value.trim();
      }
      updatedSite.link_mode = 'none';

      // 2) orgData basic 업데이트
      const updatedOrg = {...orgData};
      updatedOrg.basic = updatedOrg.basic || {};
      for(const [id, key] of Object.entries(basicFields)){
        if($(id)){
          const val = $(id).value.trim();
          if(['members_total','members_male','members_female','facility_capacity','rooms','restrooms','kitchen','sub_rooms'].includes(key)){
            updatedOrg.basic[key] = val ? parseInt(val, 10) : '';
          } else {
            updatedOrg.basic[key] = val;
          }
        }
      }
      updatedOrg.basic.name = orgName;
      updatedOrg.basic.parent_organization = $('s-parent') ? $('s-parent').value.trim() : updatedOrg.basic.parent_organization;
      updatedOrg.basic.branch_name = $('s-branch') ? $('s-branch').value.trim() : updatedOrg.basic.branch_name;

      // 시설안내 태그 자동 동기화
      const bRooms = updatedOrg.basic.rooms || 3;
      const bRest = updatedOrg.basic.restrooms || 2;
      const bKit = updatedOrg.basic.kitchen || 1;
      const bSub = updatedOrg.basic.sub_rooms || 1;
      updatedOrg.facilities = [
        `방 ${bRooms}개`,
        `화장실 ${bRest}개`,
        `주방 ${bKit}개`,
        `보조실 ${bSub}개`,
        '우경정 쉼터',
        '실외운동기구'
      ];

      // access 주소 동기화
      if(!updatedOrg.access) updatedOrg.access = {};
      if(updatedOrg.basic.address){
        updatedOrg.access.address = updatedOrg.basic.address;
      }
      if(updatedSite.map_url){
        updatedOrg.access.map_url = updatedSite.map_url;
      }

      // 두 API 저장 요청 동시 수행
      const [resSite, resOrg] = await Promise.all([
        fetch('../api/admin/data', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify({name: 'site', data: updatedSite})
        }),
        fetch('../api/admin/data', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify({name: 'organization', data: updatedOrg})
        })
      ]);

      siteData = updatedSite;
      orgData = updatedOrg;

      $('s-msg').textContent = '기본 설정과 기본현황 및 원본 파일 정보가 성공적으로 저장되었습니다.';
      window.alert('기본 설정 및 기본현황/원본 파일 정보를 모두 저장했습니다.\n경로당 소개 페이지에 즉시 반영됩니다.');
      updatePreviews();
    } catch(error){
      $('s-msg').textContent = error.message || '저장 중 오류가 발생했습니다.';
    } finally {
      $('s-save').disabled = false;
    }
  };
})();
