import * as THREE from "https://cdn.skypack.dev/three@0.152.2";

// ----------------- Three.js: الأرض + السحب -----------------
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);
let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("intro").appendChild(renderer.domElement);

const loader = new THREE.TextureLoader();

// الخلفية المتحركة
const spaceTexture = loader.load("space.jpg");
spaceTexture.wrapS = THREE.RepeatWrapping;
spaceTexture.wrapT = THREE.RepeatWrapping;
spaceTexture.repeat.set(1, 1);
scene.background = spaceTexture;

// الأرض
let earthTexture = loader.load("earth.jpg");
let earth = new THREE.Mesh(
  new THREE.SphereGeometry(2, 64, 64),
  new THREE.MeshBasicMaterial({ map: earthTexture })
);
scene.add(earth);

// السحب
let cloudTexture = loader.load("clouds.jpg");
let clouds = new THREE.Mesh(
  new THREE.SphereGeometry(2.05, 64, 64),
  new THREE.MeshBasicMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.4,
  })
);
scene.add(clouds);

camera.position.z = 5;

// ----------------- Animate -----------------
function animate() {
  requestAnimationFrame(animate);

  earth.rotation.y += 0.0005;
  clouds.rotation.y += 0.0008;

  // شفافية السحب حسب مسافة الكاميرا
  clouds.material.opacity = Math.min(
    0.6,
    Math.max(0, (camera.position.z - 1.5) / 8)
  );

  // تحريك الخلفية زي الكود القديم
  spaceTexture.offset.x += 0.00005;
  spaceTexture.offset.y += 0.00002;

  renderer.render(scene, camera);
}
animate();

// تكبير وتصغير الأرض بالـ scroll
window.addEventListener("wheel", (event) => {
  event.preventDefault();
  camera.position.z += event.deltaY * 0.01;
  if (camera.position.z < 1) camera.position.z = 1;
  if (camera.position.z > 10) camera.position.z = 10;
});

// تغيير حجم الشاشة
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----------------- Leaflet: الضغط على الأرض -----------------
renderer.domElement.addEventListener("click", (event) => {
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(earth);

  if (intersects.length > 0) {
    const point = intersects[0].point;

    // حركة تقريب تدريجية
    const zoomInterval = setInterval(() => {
      camera.position.z -= 0.05;
      clouds.material.opacity = Math.min(
        0.8,
        Math.max(0, (camera.position.z - 1.5) / 8)
      );

      if (camera.position.z <= 1.5) {
        clearInterval(zoomInterval);

        // نخفي Three.js ونظهر الخريطة
        document.getElementById("intro").style.display = "none";
        document.getElementById("map").style.display = "block";

        // نحسب إحداثيات من النقطة على الكرة
        const radius = 2;
        const lat = 90 - Math.acos(point.y / radius) * (180 / Math.PI);
        const lon = (Math.atan2(point.z, point.x) * 180) / Math.PI;

        // ----------------- إنشاء الخريطة -----------------
        const map = L.map("map", {
          center: [lat, lon],
          zoom: 5,
          minZoom: 2,
          maxBounds: [
            [-90, -180],
            [90, 180],
          ],
          maxBoundsViscosity: 1.0,
        });

        const osm = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            noWrap: true,
            attribution: "&copy; OpenStreetMap contributors",
          }
        );

        const satellite = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, attribution: "Tiles © Esri" }
        );

        const hybrid = L.layerGroup([
          satellite,
          L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19, attribution: "Labels © Esri" }
          ),
        ]);

        hybrid.addTo(map); // هنا نخليها الهايبريد تظهر افتراضياً

        const baseMaps = {
          "🗺️ Streets": osm,
          "🛰️ Satellite": satellite,
          "🌍 Hybrid": hybrid,
        };
        L.control.layers(baseMaps, null, { collapsed: false }).addTo(map);

        // ----------------- Dropdown للقروش -----------------
        const sharkMarkers = {};
        fetch("sharks.csv")
          .then((res) => res.text())
          .then((text) => {
            const lines = text
              .trim()
              .split(/\r?\n/)
              .filter((l) => l.trim().length > 0);
            if (lines.length <= 1) return;
            const headers = lines[0].split(",").map((h) => h.trim());
            const idIdx = headers.indexOf("id");
            const latIdx = headers.indexOf("lat");
            const lonIdx = headers.indexOf("lon");

            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(",").map((c) => c.trim());
              const name = cols[idIdx] || "Unknown";
              const lat = parseFloat(cols[latIdx]);
              const lon = parseFloat(cols[lonIdx]);
              if (!isNaN(lat) && !isNaN(lon)) {
                const marker = L.marker([lat, lon], {
                  icon: L.icon({
                    iconUrl: "shark.svg",
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                    popupAnchor: [0, -16],
                  }),
                }).addTo(map);
                marker.bindPopup(
                  `<b>${name}</b><br>Lat:${lat.toFixed(4)}, Lon:${lon.toFixed(
                    4
                  )}`
                );
                sharkMarkers[name] = marker;

                const option = document.createElement("option");
                option.value = name;
                option.text = name;
                document.getElementById("sharkSelect").appendChild(option);
              }
            }
          });

        document
          .getElementById("sharkSelect")
          .addEventListener("change", function () {
            const selected = this.value;
            if (selected && sharkMarkers[selected]) {
              const marker = sharkMarkers[selected];
              map.setView(marker.getLatLng(), 6);
              marker.openPopup();
            }
          });

        // ----------------- Plankton + Chart -----------------
        // ----------------- Plankton + Chart -----------------
        let planktonCircles = [];
        let planktonData = [];

        fetch("plankton.json")
          .then((res) => res.json())
          .then((data) => {
            planktonData = data;

            data.forEach((item) => {
              const circle = L.circle([item.lat, item.lon], {
                radius: 50000,
                color: "blue",
                fillColor: "lightblue",
                fillOpacity: 0.6,
              }).addTo(map);
              planktonCircles.push(circle);
            });

            const ctx = document
              .getElementById("planktonChart")
              .getContext("2d");
            new Chart(ctx, {
              type: "bar",
              data: {
                labels: data.map((d) => `(${d.lat},${d.lon})`),
                datasets: [
                  {
                    label: "Plankton Concentration",
                    data: data.map((d) => d.concentration),
                    backgroundColor: "rgba(54,162,235,0.6)",
                  },
                ],
              },
              options: {
                responsive: false,
                plugins: { legend: { display: false } },
                onClick: (evt, elements) => {
                  if (elements.length > 0) {
                    const index = elements[0].index;
                    const point = planktonData[index];
                    if (point) {
                      map.setView([point.lat, point.lon], 7); // تقريب للمكان
                    }
                  }
                },
              },
            });
          });
      }
    }, 20);
  }
});
