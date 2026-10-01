import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x91cbea);
scene.fog = new THREE.Fog(0x91cbea, 140, 900);

const camera = new THREE.PerspectiveCamera(
    62,
    window.innerWidth / window.innerHeight,
    0.1,
    3000
);

camera.position.set(0, 5, 12);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

const mobileGraphics =
    window.matchMedia(
        "(hover: none), (pointer: coarse)"
    ).matches;


renderer.setPixelRatio(

    Math.min(

        window.devicePixelRatio,

        mobileGraphics
            ? 1.35
            : 2

    )

);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

document
    .getElementById("game-container")
    .appendChild(renderer.domElement);

const clock = new THREE.Clock();

const sunlight = new THREE.DirectionalLight(
    0xfff2dd,
    3.5
);

sunlight.position.set(
    -50,
    100,
    60
);

sunlight.castShadow = true;

sunlight.shadow.mapSize.width = 2048;
sunlight.shadow.mapSize.height = 2048;

sunlight.shadow.camera.left = -100;
sunlight.shadow.camera.right = 100;
sunlight.shadow.camera.top = 100;
sunlight.shadow.camera.bottom = -80;

scene.add(sunlight);

const hemisphereLight = new THREE.HemisphereLight(
    0xd8efff,
    0x536a3c,
    1.8
);

scene.add(hemisphereLight);

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    0.42
);

scene.add(ambientLight);

const sun = new THREE.Mesh(
    new THREE.SphereGeometry(
        8,
        20,
        20
    ),

    new THREE.MeshBasicMaterial({
        color: 0xffdd66
    })
);

sun.position.set(
    -90,
    80,
    -450
);

scene.add(sun);


// ============================================================
// STEP 12 CONSTANTS
// ============================================================

const ROAD_WIDTH = 24;

const MAX_SPEED = 800;

// Nitro allows a temporary speed above normal maximum.
const NITRO_MAX_SPEED = 900;

const WORLD_LENGTH = 7000;

const PLAYER_Z = 2;


// ============================================================
// GAME STATE
// ============================================================

let speed = 0;

let worldDistance = 0;

let score = 0;

let gameOver = false;

let paused = false;

let currentLevel = 1;

let completedCycles = 0;

let bikeLaneOffset = -3;


// ============================================================
// STEP 12 STATE
// ============================================================

let health = 100;

let nitro = 100;

let nitroActive = false;

let combo = 1;

let comboTimer = 0;

let checkpointNumber = 1;

let nextCheckpoint = 1000;

let checkpointMessageTimer = 0;

let warningTimer = 0;

let collisionCooldown = 0;

let crashAnimationTime = 0;

let cameraShake = 0;

let countdownActive = true;

let countdownTime = 4;

let raceStarted = false;


// ============================================================
// LOCAL BEST SCORE / DISTANCE
// ============================================================

let bestScore = Number(
    localStorage.getItem(
        "bikeGameBestScore"
    ) || 0
);

let bestDistance = Number(
    localStorage.getItem(
        "bikeGameBestDistance"
    ) || 0
);


// ============================================================
// LEVELS
// ============================================================

const LEVELS = [

    {
        id: 1,
        name: "COUNTRYSIDE",
        icon: "🌾"
    },

    {
        id: 2,
        name: "CITY",
        icon: "🏙️"
    },

    {
        id: 3,
        name: "MOUNTAINS",
        icon: "🏔️"
    },

    {
        id: 4,
        name: "TUNNEL",
        icon: "🚇"
    },

    {
        id: 5,
        name: "MEGA BRIDGE",
        icon: "🌉"
    }

];


function getLevelFromDistance(distance) {

    const d =
        ((distance % WORLD_LENGTH) + WORLD_LENGTH)
        % WORLD_LENGTH;

    if (d < 1500) return 1;

    if (d < 3000) return 2;

    if (d < 4500) return 3;

    if (d < 5500) return 4;

    return 5;
}


// ============================================================
// ROAD PATH
// ============================================================

function getRoadData(distance) {

    const level =
        getLevelFromDistance(distance);

    let x =
        Math.sin(distance * 0.0022) * 7 +
        Math.sin(distance * 0.0007) * 4;

    let dx =
        Math.cos(distance * 0.0022) * 0.0154 +
        Math.cos(distance * 0.0007) * 0.0028;

    let y =
        Math.sin(distance * 0.0017) * 0.7;

    let dy =
        Math.cos(distance * 0.0017) * 0.00119;

    if (level === 3) {

        x +=
            Math.sin(distance * 0.005) * 9;

        dx +=
            Math.cos(distance * 0.005) * 0.045;

        y +=
            Math.sin(distance * 0.0035) * 3;

        dy +=
            Math.cos(distance * 0.0035) * 0.0105;
    }

    if (level === 4) {

        x +=
            Math.sin(distance * 0.0035) * 3;

        dx +=
            Math.cos(distance * 0.0035) * 0.0105;
    }

    if (level === 5) {

        x +=
            Math.sin(distance * 0.0015) * 6;

        dx +=
            Math.cos(distance * 0.0015) * 0.009;

        y += 3;
    }

    return {

        x,

        y,

        heading:
            Math.atan(dx),

        pitch:
            Math.atan(dy),

        level

    };
}


// ============================================================
// GROUND
// ============================================================

const groundMaterial =
    new THREE.MeshStandardMaterial({

        color: 0x648f45,

        roughness: 1,

        side: THREE.DoubleSide

    });


const ground = new THREE.Mesh(

    new THREE.PlaneGeometry(
        1000,
        2200
    ),

    groundMaterial

);

ground.rotation.x =
    -Math.PI / 2;

ground.position.set(
    0,
    -2.5,
    -700
);

ground.receiveShadow = true;

scene.add(ground);


// ============================================================
// ROAD MATERIALS
// ============================================================

const roadMaterial =
    new THREE.MeshStandardMaterial({

        color: 0x484848,

        roughness: 0.92

    });


const shoulderMaterial =
    new THREE.MeshStandardMaterial({

        color: 0x95876a,

        roughness: 1

    });


const whiteMaterial =
    new THREE.MeshBasicMaterial({
        color: 0xffffff
    });


const yellowMaterial =
    new THREE.MeshBasicMaterial({
        color: 0xffd32a
    });


// ============================================================
// ROAD SEGMENTS
// ============================================================

const SEGMENT_LENGTH = 10;

const SEGMENT_COUNT = 150;

const roadSegments = [];


function createRoadSegment() {

    const group =
        new THREE.Group();

    const road = new THREE.Mesh(

        new THREE.BoxGeometry(
            ROAD_WIDTH,
            0.16,
            SEGMENT_LENGTH + 0.8
        ),

        roadMaterial

    );

    road.receiveShadow = true;

    group.add(road);


    [-12.8, 12.8].forEach(x => {

        const shoulder =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    1.6,
                    0.12,
                    SEGMENT_LENGTH + 0.8
                ),

                shoulderMaterial

            );

        shoulder.position.set(
            x,
            -0.02,
            0
        );

        group.add(shoulder);

    });


    [-11.75, 11.75].forEach(x => {

        const line =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.15,
                    0.03,
                    SEGMENT_LENGTH + 0.2
                ),

                whiteMaterial

            );

        line.position.set(
            x,
            0.105,
            0
        );

        group.add(line);

    });


    [-0.22, 0.22].forEach(x => {

        const line =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.13,
                    0.035,
                    SEGMENT_LENGTH + 0.2
                ),

                yellowMaterial

            );

        line.position.set(
            x,
            0.11,
            0
        );

        group.add(line);

    });


    [-6, 6].forEach(x => {

        const dash =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.14,
                    0.04,
                    4.5
                ),

                whiteMaterial

            );

        dash.position.set(
            x,
            0.115,
            0
        );

        group.add(dash);

    });


    scene.add(group);

    return group;
}


for (
    let i = 0;
    i < SEGMENT_COUNT;
    i++
) {

    const segment =
        createRoadSegment();

    roadSegments.push({

        object:
            segment,

        index:
            i

    });

}


function updateRoad() {

    const baseSegment =
        Math.floor(
            worldDistance /
            SEGMENT_LENGTH
        );

    const segmentProgress =
        worldDistance %
        SEGMENT_LENGTH;


    for (
        let i = 0;
        i < roadSegments.length;
        i++
    ) {

        const segment =
            roadSegments[i];

        const relativeDistance =
            i *
            SEGMENT_LENGTH -
            segmentProgress;

        const absoluteDistance =

            (
                baseSegment *
                SEGMENT_LENGTH
            ) +

            (
                i *
                SEGMENT_LENGTH
            );

        const data =
            getRoadData(
                absoluteDistance
            );

        segment.object.position.set(

            data.x,

            data.y,

            PLAYER_Z -
            relativeDistance

        );

        segment.object.rotation.y =
            -data.heading;

        segment.object.rotation.x =
            data.pitch;

    }

}


// ============================================================
// SCENERY
// ============================================================

const scenery = [];

const SCENERY_COUNT = 80;


function createTree() {

    const group =
        new THREE.Group();

    const trunk =
        new THREE.Mesh(

            new THREE.CylinderGeometry(
                0.3,
                0.45,
                3,
                8
            ),

            new THREE.MeshStandardMaterial({
                color: 0x60452f
            })

        );

    trunk.position.y =
        1.5;

    group.add(trunk);


    const leaves =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                1.5,
                9,
                8
            ),

            new THREE.MeshStandardMaterial({

                color:
                    Math.random() > 0.5
                        ? 0x1e7336
                        : 0x2d7c3c

            })

        );

    leaves.position.y =
        3.8;

    leaves.castShadow =
        true;

    group.add(leaves);

    return group;
}


function createBuilding() {

    const group =
        new THREE.Group();

    const height =
        8 +
        Math.random() * 20;

    const body =
        new THREE.Mesh(

            new THREE.BoxGeometry(

                6 +
                Math.random() * 4,

                height,

                7 +
                Math.random() * 4

            ),

            new THREE.MeshStandardMaterial({

                color:
                    new THREE.Color().setHSL(

                        0.08 +
                        Math.random() * 0.08,

                        0.15,

                        0.55 +
                        Math.random() * 0.18

                    ),

                roughness: 0.75

            })

        );

    body.position.y =
        height / 2;

    body.castShadow =
        true;

    group.add(body);


    for (
        let y = 3;
        y < height - 1;
        y += 3
    ) {

        const windowPanel =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    3,
                    0.6,
                    0.05
                ),

                new THREE.MeshStandardMaterial({

                    color: 0x8ecae6,

                    emissive: 0x244b5c,

                    emissiveIntensity: 0.3

                })

            );

        windowPanel.position.set(
            0,
            y,
            -3.6
        );

        group.add(
            windowPanel
        );

    }

    return group;
}


function createPine() {

    const group =
        new THREE.Group();

    const trunk =
        new THREE.Mesh(

            new THREE.CylinderGeometry(
                0.2,
                0.3,
                2.5,
                7
            ),

            new THREE.MeshStandardMaterial({
                color: 0x553a2a
            })

        );

    trunk.position.y =
        1.25;

    group.add(trunk);


    const leaves =
        new THREE.Mesh(

            new THREE.ConeGeometry(
                1.8,
                5,
                9
            ),

            new THREE.MeshStandardMaterial({
                color: 0x174a2d
            })

        );

    leaves.position.y =
        4;

    leaves.castShadow =
        true;

    group.add(leaves);

    return group;
}


function createMountain() {

    const mountain =
        new THREE.Mesh(

            new THREE.ConeGeometry(
                12,
                25,
                7
            ),

            new THREE.MeshStandardMaterial({

                color: 0x696c63,

                flatShading: true,

                roughness: 1

            })

        );

    mountain.position.y =
        10;

    mountain.castShadow =
        true;

    return mountain;
}


function createStreetLight() {

    const group =
        new THREE.Group();

    const pole =
        new THREE.Mesh(

            new THREE.CylinderGeometry(
                0.06,
                0.1,
                6,
                8
            ),

            new THREE.MeshStandardMaterial({
                color: 0x444444
            })

        );

    pole.position.y =
        3;

    group.add(pole);


    const lamp =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.6,
                0.15,
                0.35
            ),

            new THREE.MeshStandardMaterial({

                color: 0xffffcc,

                emissive: 0xffdd88,

                emissiveIntensity: 2

            })

        );

    lamp.position.set(
        0,
        5.8,
        0
    );

    group.add(lamp);

    return group;
}


for (
    let i = 0;
    i < SCENERY_COUNT;
    i++
) {

    const holder =
        new THREE.Group();

    scene.add(holder);

    scenery.push({

        holder,

        slot:
            i,

        currentType:
            0,

        side:
            i % 2 === 0
                ? -1
                : 1

    });

}


function setSceneryType(
    item,
    level
) {

    while (
        item.holder.children.length
    ) {

        item.holder.remove(
            item.holder.children[0]
        );

    }


    let object;


    if (level === 1) {

        object =
            createTree();

    }

    else if (level === 2) {

        if (
            item.slot % 4 === 0
        ) {

            object =
                createStreetLight();

        }

        else {

            object =
                createBuilding();

        }

    }

    else if (level === 3) {

        if (
            item.slot % 4 === 0
        ) {

            object =
                createMountain();

        }

        else {

            object =
                createPine();

        }

    }

    else {

        object =
            createStreetLight();

    }


    item.holder.add(object);

    item.currentType =
        level;

}


function updateScenery() {

    const spacing =
        24;

    const sceneryBase =
        Math.floor(
            worldDistance /
            spacing
        );

    const progress =
        worldDistance %
        spacing;


    scenery.forEach(
        (item, index) => {

            const relative =
                35 +
                index *
                spacing -
                progress;

            const absolute =
                (
                    sceneryBase *
                    spacing
                ) +
                35 +
                index *
                spacing;

            const roadData =
                getRoadData(
                    absolute
                );


            if (
                item.currentType !==
                roadData.level
            ) {

                setSceneryType(
                    item,
                    roadData.level
                );

            }


            let sideDistance =
                18 +
                (
                    index %
                    5
                ) *
                3;


            if (
                roadData.level === 3 &&
                index % 4 === 0
            ) {

                sideDistance =
                    35 +
                    (
                        index %
                        3
                    ) *
                    10;

            }


            const lateral =
                sideDistance *
                item.side;


            item.holder.position.set(

                roadData.x +
                lateral,

                roadData.y,

                PLAYER_Z -
                relative

            );


            item.holder.rotation.y =
                -roadData.heading;

        }
    );

}

// ============================================================
// TUNNEL
// ============================================================

const tunnelPieces = [];


function createTunnelPiece() {

    const group =
        new THREE.Group();


    const concrete =
        new THREE.MeshStandardMaterial({

            color: 0x44484d,

            roughness: 0.9

        });


    const left =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                1,
                9,
                14
            ),

            concrete

        );


    left.position.set(
        -12.5,
        4.5,
        0
    );


    group.add(left);


    const right =
        left.clone();


    right.position.x =
        12.5;


    group.add(right);


    const roof =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                26,
                1,
                14
            ),

            concrete

        );


    roof.position.y =
        9;


    group.add(roof);


    const lamp =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                3,
                0.12,
                0.8
            ),

            new THREE.MeshStandardMaterial({

                color: 0xffffdd,

                emissive: 0xffdd88,

                emissiveIntensity: 3

            })

        );


    lamp.position.y =
        8.3;


    group.add(lamp);


    scene.add(group);


    return group;
}


// ============================================================
// BUILD TUNNEL POOL
// ============================================================

for (
    let i = 0;
    i < 95;
    i++
) {

    tunnelPieces.push({

        object:
            createTunnelPiece(),

        slot:
            i

    });

}


// ============================================================
// UPDATE TUNNEL
// ============================================================

function updateTunnel() {

    const spacing =
        14;


    const base =
        Math.floor(
            worldDistance /
            spacing
        );


    const progress =
        worldDistance %
        spacing;


    tunnelPieces.forEach(
        (piece, index) => {

            const relative =
                index *
                spacing -
                progress;


            const absolute =
                (
                    base *
                    spacing
                ) +
                index *
                spacing;


            const data =
                getRoadData(
                    absolute
                );


            piece.object.visible =
                data.level === 4;


            if (
                !piece.object.visible
            ) {

                return;

            }


            piece.object.position.set(

                data.x,

                data.y,

                PLAYER_Z -
                relative

            );


            piece.object.rotation.y =
                -data.heading;


            piece.object.rotation.x =
                data.pitch;

        }
    );

}


// ============================================================
// MEGA BRIDGE
// ============================================================

const bridgePieces = [];


// ============================================================
// BRIDGE WATER
// ============================================================

const bridgeWater =
    new THREE.Mesh(

        new THREE.PlaneGeometry(
            800,
            1800
        ),

        new THREE.MeshStandardMaterial({

            color: 0x147ca8,

            roughness: 0.2,

            metalness: 0.15,

            side: THREE.DoubleSide

        })

    );


bridgeWater.rotation.x =
    -Math.PI / 2;


bridgeWater.position.set(
    0,
    -2,
    -700
);


scene.add(bridgeWater);


// ============================================================
// CREATE BRIDGE PIECE
// ============================================================

function createBridgePiece(
    tower = false
) {

    const group =
        new THREE.Group();


    const material =
        new THREE.MeshStandardMaterial({
            color: 0xd5d7d8
        });


    [-12.2, 12.2].forEach(x => {

        const barrier =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.45,
                    1.2,
                    18
                ),

                material

            );


        barrier.position.set(
            x,
            0.6,
            0
        );


        group.add(barrier);

    });


    if (tower) {

        [-11.5, 11.5].forEach(x => {

            const column =
                new THREE.Mesh(

                    new THREE.BoxGeometry(
                        1,
                        20,
                        1
                    ),

                    material

                );


            column.position.set(
                x,
                10,
                0
            );


            group.add(column);

        });


        const top =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    24,
                    1,
                    1
                ),

                material

            );


        top.position.y =
            19;


        group.add(top);

    }


    scene.add(group);


    return group;
}


// ============================================================
// BUILD BRIDGE POOL
// ============================================================

for (
    let i = 0;
    i < 75;
    i++
) {

    bridgePieces.push({

        object:
            createBridgePiece(
                i % 15 === 0
            ),

        slot:
            i

    });

}


// ============================================================
// UPDATE BRIDGE
// ============================================================

function updateBridge() {

    const spacing =
        18;


    const base =
        Math.floor(
            worldDistance /
            spacing
        );


    const progress =
        worldDistance %
        spacing;


    let visible =
        false;


    bridgePieces.forEach(
        (piece, index) => {

            const relative =
                index *
                spacing -
                progress;


            const absolute =
                (
                    base *
                    spacing
                ) +
                index *
                spacing;


            const data =
                getRoadData(
                    absolute
                );


            piece.object.visible =
                data.level === 5;


            if (
                data.level !== 5
            ) {

                return;

            }


            visible =
                true;


            piece.object.position.set(

                data.x,

                data.y,

                PLAYER_Z -
                relative

            );


            piece.object.rotation.y =
                -data.heading;


            piece.object.rotation.x =
                data.pitch;

        }
    );


    bridgeWater.visible =
        visible;

}


// ============================================================
// BIKE
// ============================================================

const bike =
    new THREE.Group();


scene.add(bike);


// ============================================================
// RIDER
// ============================================================

const riderGroup =
    new THREE.Group();


riderGroup.position.set(
    0,
    -0.12,
    0.20
);


// ============================================================
// RIDER TORSO
// ============================================================

const torso =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            0.68,
            0.95,
            0.46
        ),

        new THREE.MeshStandardMaterial({
            color: 0x1565c0
        })

    );


torso.position.set(
    0,
    1.72,
    0.28
);


torso.rotation.x =
    -0.62;


torso.castShadow =
    true;


riderGroup.add(torso);


// ============================================================
// RIDER JACKET
// ============================================================

const jacket =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            0.48,
            0.55,
            0.05
        ),

        new THREE.MeshStandardMaterial({
            color: 0xe53935
        })

    );


jacket.position.set(
    0,
    1.75,
    0.53
);


jacket.rotation.x =
    -0.62;


riderGroup.add(jacket);


// ============================================================
// HELMET
// ============================================================

const helmet =
    new THREE.Mesh(

        new THREE.SphereGeometry(
            0.37,
            20,
            18
        ),

        new THREE.MeshStandardMaterial({

            color: 0xffffff,

            metalness: 0.15,

            roughness: 0.25

        })

    );


helmet.position.set(
    0,
    2.26,
    -0.12
);


helmet.castShadow =
    true;


riderGroup.add(helmet);


// ============================================================
// VISOR
// ============================================================

const visor =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            0.48,
            0.17,
            0.07
        ),

        new THREE.MeshStandardMaterial({
            color: 0x16394e
        })

    );


visor.position.set(
    0,
    2.26,
    -0.45
);


riderGroup.add(visor);


// ============================================================
// RIDER ARMS
// ============================================================

[-0.34, 0.34].forEach(x => {

    const arm =
        new THREE.Mesh(

            new THREE.CylinderGeometry(
                0.085,
                0.105,
                0.88,
                10
            ),

            new THREE.MeshStandardMaterial({
                color: 0x1565c0
            })

        );


    arm.position.set(
        x,
        1.55,
        -0.30
    );


    arm.rotation.x =
        1.05;


    arm.rotation.z =
        x < 0
            ? -0.20
            : 0.20;


    riderGroup.add(arm);

});


// ============================================================
// RIDER LEGS
// ============================================================

[-0.28, 0.28].forEach(x => {

    const leg =
        new THREE.Mesh(

            new THREE.CylinderGeometry(
                0.105,
                0.125,
                1,
                10
            ),

            new THREE.MeshStandardMaterial({
                color: 0x263747
            })

        );


    leg.position.set(
        x,
        0.96,
        0.55
    );


    leg.rotation.x =
        -0.85;


    riderGroup.add(leg);

});


bike.add(riderGroup);


// ============================================================
// LOAD REAL MOTORCYCLE
//
// IMPORTANT:
// We are still using ONLY:
//
// models/bike.glb
//
// No car.glb
// No truck.glb
//
// ============================================================

const loader =
    new GLTFLoader();


const bikeModelWheels = [];


loader.load(

    "./models/bike.glb",

    gltf => {

        const model =
            gltf.scene;


        model.traverse(object => {

            if (
                object.isMesh
            ) {

                object.castShadow =
                    true;


                object.receiveShadow =
                    true;

            }


            const name =
                (
                    object.name ||
                    ""
                ).toLowerCase();


            if (

                name.includes("wheel") ||

                name.includes("tyre") ||

                name.includes("tire")

            ) {

                bikeModelWheels.push(
                    object
                );

            }

        });


        // ----------------------------------------
        // AUTO SCALE BIKE
        // ----------------------------------------

        const box =
            new THREE.Box3()
                .setFromObject(
                    model
                );


        const size =
            new THREE.Vector3();


        box.getSize(size);


        const largest =
            Math.max(
                size.x,
                size.y,
                size.z
            );


        if (
            largest > 0
        ) {

            model.scale.setScalar(
                2.8 /
                largest
            );

        }


        // ----------------------------------------
        // AUTO CENTER AFTER SCALE
        // ----------------------------------------

        const scaledBox =
            new THREE.Box3()
                .setFromObject(
                    model
                );


        const center =
            new THREE.Vector3();


        scaledBox.getCenter(
            center
        );


        model.position.x -=
            center.x;


        model.position.z -=
            center.z;


        model.position.y -=
            scaledBox.min.y;


        model.position.y +=
            0.05;


        // Face motorcycle forward

        model.rotation.y =
            Math.PI;


        bike.add(model);


        console.log(
            "Step 12 bike.glb loaded successfully!"
        );

    },


    progress => {

        if (
            progress.total
        ) {

            console.log(

                "Bike loading:",

                Math.round(
                    progress.loaded /
                    progress.total *
                    100
                ) + "%"

            );

        }

    },


    error => {

        console.error(
            "bike.glb loading error:",
            error
        );

    }

);


// ============================================================
// GENERATED VEHICLE COLORS
// ============================================================

function randomVehicleColor() {

    const colors = [

        0xe53935,

        0x1976d2,

        0xffffff,

        0xf1c40f,

        0x607d8b,

        0x8e44ad,

        0x16a085,

        0xe67e22,

        0x263238

    ];


    return colors[

        Math.floor(
            Math.random() *
            colors.length
        )

    ];

}


// ============================================================
// GENERATED CAR
// ============================================================

function buildCar() {

    const group =
        new THREE.Group();


    const body =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                2.15,
                0.65,
                4
            ),

            new THREE.MeshStandardMaterial({

                color:
                    randomVehicleColor(),

                metalness: 0.3,

                roughness: 0.4

            })

        );


    body.position.y =
        0.72;


    body.castShadow =
        true;


    group.add(body);


    const cabin =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                1.7,
                0.72,
                1.8
            ),

            new THREE.MeshStandardMaterial({

                color: 0x8ebbd0,

                roughness: 0.2

            })

        );


    cabin.position.set(
        0,
        1.35,
        0
    );


    group.add(cabin);


    const wheels = [];


    [

        [-1.05, 0.45, -1.25],

        [1.05, 0.45, -1.25],

        [-1.05, 0.45, 1.25],

        [1.05, 0.45, 1.25]

    ].forEach(p => {

        const wheel =
            new THREE.Mesh(

                new THREE.CylinderGeometry(
                    0.38,
                    0.38,
                    0.25,
                    16
                ),

                new THREE.MeshStandardMaterial({
                    color: 0x111111
                })

            );


        wheel.rotation.z =
            Math.PI / 2;


        wheel.position.set(
            p[0],
            p[1],
            p[2]
        );


        group.add(wheel);


        wheels.push(wheel);

    });


    // HEADLIGHTS + TAIL LIGHTS

    [-0.65, 0.65].forEach(x => {

        const head =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.4,
                    0.18,
                    0.08
                ),

                new THREE.MeshStandardMaterial({

                    color: 0xffffff,

                    emissive: 0xffffdd,

                    emissiveIntensity: 1.5

                })

            );


        head.position.set(
            x,
            0.8,
            -2.03
        );


        group.add(head);


        const tail =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.4,
                    0.18,
                    0.08
                ),

                new THREE.MeshStandardMaterial({

                    color: 0xff2222,

                    emissive: 0xff0000,

                    emissiveIntensity: 1.3

                })

            );


        tail.position.set(
            x,
            0.8,
            2.03
        );


        group.add(tail);

    });


    return {

        object:
            group,

        wheels

    };

}


// ============================================================
// GENERATED TRUCK
// ============================================================

function buildTruck() {

    const group =
        new THREE.Group();


    const cargo =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                2.8,
                2.9,
                5.4
            ),

            new THREE.MeshStandardMaterial({

                color: 0xe3e3e3,

                roughness: 0.7

            })

        );


    cargo.position.set(
        0,
        1.9,
        0.8
    );


    cargo.castShadow =
        true;


    group.add(cargo);


    const cab =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                2.75,
                2.3,
                2
            ),

            new THREE.MeshStandardMaterial({

                color:
                    randomVehicleColor(),

                metalness: 0.2

            })

        );


    cab.position.set(
        0,
        1.4,
        -3
    );


    group.add(cab);


    const wheels = [];


    [

        [-1.4, 0.55, -2.7],

        [1.4, 0.55, -2.7],

        [-1.4, 0.55, 1.5],

        [1.4, 0.55, 1.5],

        [-1.4, 0.55, 2.7],

        [1.4, 0.55, 2.7]

    ].forEach(p => {

        const wheel =
            new THREE.Mesh(

                new THREE.CylinderGeometry(
                    0.46,
                    0.46,
                    0.3,
                    16
                ),

                new THREE.MeshStandardMaterial({
                    color: 0x111111
                })

            );


        wheel.rotation.z =
            Math.PI / 2;


        wheel.position.set(
            p[0],
            p[1],
            p[2]
        );


        group.add(wheel);


        wheels.push(wheel);

    });


    return {

        object:
            group,

        wheels

    };

}

// ============================================================
// TRAFFIC
// ============================================================

const traffic = [];

const sameTrafficPositions = [
    -9,
    -6.5,
    -3,
    -1.35
];

const oncomingTrafficPositions = [
    1.35,
    3,
    6.5,
    9
];


// ============================================================
// ADD TRAFFIC VEHICLE
// ============================================================

function addTrafficVehicle(
    direction,
    truck,
    distanceAhead,
    laneOffset
) {

    const built =
        truck
            ? buildTruck()
            : buildCar();


    scene.add(
        built.object
    );


    const vehicle = {

        object:
            built.object,

        wheels:
            built.wheels,

        direction,

        truck,

        distanceAhead,

        previousDistanceAhead:
            distanceAhead,

        laneOffset,

        targetLaneOffset:
            laneOffset,

        vehicleSpeed:

            direction === "same"

                ? (
                    truck
                        ? 80 +
                          Math.random() * 55

                        : 100 +
                          Math.random() * 100
                )

                : (
                    truck
                        ? 80 +
                          Math.random() * 60

                        : 100 +
                          Math.random() * 120
                ),

        passed:
            false,

        nearMiss:
            false

    };


    traffic.push(
        vehicle
    );

}


// ============================================================
// INITIAL SAME-DIRECTION TRAFFIC
// ============================================================

for (
    let i = 0;
    i < 5;
    i++
) {

    addTrafficVehicle(

        "same",

        i % 3 === 0,

        180 +
        i * 170,

        sameTrafficPositions[
            i %
            sameTrafficPositions.length
        ]

    );

}


// ============================================================
// INITIAL ONCOMING TRAFFIC
// ============================================================

for (
    let i = 0;
    i < 5;
    i++
) {

    addTrafficVehicle(

        "oncoming",

        i % 4 === 0,

        260 +
        i * 190,

        oncomingTrafficPositions[
            i %
            oncomingTrafficPositions.length
        ]

    );

}


// ============================================================
// OBSTACLES
// ============================================================

const obstacles = [];


// ============================================================
// CREATE BARRIER
// ============================================================

function createBarrier() {

    const group =
        new THREE.Group();


    const body =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                2,
                0.85,
                0.6
            ),

            new THREE.MeshStandardMaterial({
                color: 0xff7b00
            })

        );


    body.position.y =
        0.55;


    body.castShadow =
        true;


    group.add(body);


    const stripe =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                1.45,
                0.22,
                0.62
            ),

            new THREE.MeshStandardMaterial({
                color: 0xffffff
            })

        );


    stripe.position.set(
        0,
        0.58,
        0
    );


    group.add(stripe);


    return group;

}


// ============================================================
// CREATE CONE
// ============================================================

function createCone() {

    const group =
        new THREE.Group();


    const cone =
        new THREE.Mesh(

            new THREE.ConeGeometry(
                0.42,
                1.15,
                12
            ),

            new THREE.MeshStandardMaterial({
                color: 0xff6d00
            })

        );


    cone.position.y =
        0.58;


    cone.castShadow =
        true;


    group.add(cone);


    const stripe =
        new THREE.Mesh(

            new THREE.CylinderGeometry(
                0.30,
                0.34,
                0.15,
                12
            ),

            new THREE.MeshStandardMaterial({
                color: 0xffffff
            })

        );


    stripe.position.y =
        0.52;


    group.add(stripe);


    return group;

}


// ============================================================
// ADD OBSTACLE
// ============================================================

function addObstacle(
    type,
    distanceAhead,
    laneOffset
) {

    const object =

        type === "barrier"

            ? createBarrier()

            : createCone();


    scene.add(
        object
    );


    obstacles.push({

        object,

        type,

        distanceAhead,

        previousDistanceAhead:
            distanceAhead,

        laneOffset

    });

}


// ============================================================
// INITIAL OBSTACLES
// ============================================================

addObstacle(
    "cone",
    350,
    -6
);

addObstacle(
    "barrier",
    540,
    -1.05
);

addObstacle(
    "cone",
    730,
    1.05
);

addObstacle(
    "barrier",
    930,
    6
);

addObstacle(
    "cone",
    1150,
    9
);


// ============================================================
// KEYBOARD CONTROLS
// ============================================================

const keys = {};


window.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();


        keys[key] =
            true;


        // Prevent arrow keys scrolling page

        if (

            key === "arrowup" ||

            key === "arrowdown" ||

            key === "arrowleft" ||

            key === "arrowright" ||

            key === " "

        ) {

            event.preventDefault();

        }


        // ----------------------------------------
        // PAUSE
        // ----------------------------------------

        if (
            key === "p" &&
            !gameOver &&
            !countdownActive
        ) {

            paused =
                !paused;


            pauseScreen.style.display =

                paused
                    ? "block"
                    : "none";


            // Clear accumulated frame time

            clock.getDelta();

        }


        // ----------------------------------------
        // RESTART
        // ----------------------------------------

        if (
            key === "r" &&
            gameOver
        ) {

            restartGame();

        }

    }
);


window.addEventListener(
    "keyup",
    event => {

        keys[
            event.key.toLowerCase()
        ] =
            false;

    }
);

// ============================================================
// MOBILE + TABLET TOUCH CONTROLS
// ============================================================

const isTouchDevice =
    window.matchMedia(
        "(hover: none), (pointer: coarse)"
    ).matches;


// ============================================================
// GET MOBILE BUTTONS
// ============================================================

const touchLeft =
    document.getElementById(
        "touch-left"
    );


const touchRight =
    document.getElementById(
        "touch-right"
    );


const touchGo =
    document.getElementById(
        "touch-go"
    );


const touchBrake =
    document.getElementById(
        "touch-brake"
    );


const touchNitro =
    document.getElementById(
        "touch-nitro"
    );


const mobilePause =
    document.getElementById(
        "mobile-pause"
    );


const mobileRestart =
    document.getElementById(
        "mobile-restart"
    );


// ============================================================
// TOUCH KEY BINDING
//
// This sends mobile controls into the SAME keys object
// already used by the desktop keyboard.
// ============================================================

function bindTouchControl(
    button,
    keyName
) {

    if (
        !button
    ) {

        return;

    }


    const press =
        event => {

            event.preventDefault();

            event.stopPropagation();


            keys[keyName] =
                true;


            button.classList.add(
                "control-active"
            );


            // Mobile browsers require a user action
            // before Web Audio can begin.

            startEngineSound();


            if (
                button.setPointerCapture &&
                event.pointerId !== undefined
            ) {

                try {

                    button.setPointerCapture(
                        event.pointerId
                    );

                }

                catch (error) {

                    // Safe fallback.
                    // Game continues normally.

                }

            }

        };


    const release =
        event => {

            if (
                event
            ) {

                event.preventDefault();

                event.stopPropagation();

            }


            keys[keyName] =
                false;


            button.classList.remove(
                "control-active"
            );

        };


    button.addEventListener(
        "pointerdown",
        press
    );


    button.addEventListener(
        "pointerup",
        release
    );


    button.addEventListener(
        "pointercancel",
        release
    );


    button.addEventListener(
        "lostpointercapture",
        release
    );


    button.addEventListener(
        "contextmenu",
        event => {

            event.preventDefault();

        }
    );

}


// ============================================================
// CONNECT TOUCH CONTROLS
// ============================================================

bindTouchControl(
    touchLeft,
    "a"
);


bindTouchControl(
    touchRight,
    "d"
);


bindTouchControl(
    touchGo,
    "w"
);


bindTouchControl(
    touchBrake,
    "s"
);


bindTouchControl(
    touchNitro,
    "shift"
);


// ============================================================
// CLEAR TOUCH KEYS
//
// Important when phone changes app,
// browser loses focus, etc.
// ============================================================

function clearMobileControls() {

    keys["a"] =
        false;


    keys["d"] =
        false;


    keys["w"] =
        false;


    keys["s"] =
        false;


    keys["shift"] =
        false;


    [

        touchLeft,

        touchRight,

        touchGo,

        touchBrake,

        touchNitro

    ].forEach(
        button => {

            if (
                button
            ) {

                button.classList.remove(
                    "control-active"
                );

            }

        }
    );

}


window.addEventListener(
    "blur",
    clearMobileControls
);


document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden
        ) {

            clearMobileControls();

        }

    }
);


// ============================================================
// MOBILE PAUSE
// ============================================================

if (
    mobilePause
) {

    mobilePause.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();

            event.stopPropagation();


            startEngineSound();


            if (
                gameOver ||
                countdownActive
            ) {

                return;

            }


            paused =
                !paused;


            pauseScreen.style.display =

                paused
                    ? "block"
                    : "none";


            mobilePause.textContent =

                paused
                    ? "▶"
                    : "⏸";


            clock.getDelta();

        }
    );

}


// ============================================================
// MOBILE RESTART
// ============================================================

if (
    mobileRestart
) {

    mobileRestart.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();

            event.stopPropagation();


            startEngineSound();


            if (
                gameOver
            ) {

                restartGame();

            }

        }
    );

}


// ============================================================
// PREVENT MOBILE GAME GESTURES
// ============================================================

if (
    isTouchDevice
) {

    document.addEventListener(
        "contextmenu",
        event => {

            event.preventDefault();

        }
    );


    document.addEventListener(
        "gesturestart",
        event => {

            event.preventDefault();

        },
        {
            passive: false
        }
    );

}

// ============================================================
// START ENGINE AUDIO ON FIRST USER INTERACTION
// ============================================================

window.addEventListener(
    "pointerdown",
    () => {

        startEngineSound();

    },
    {
        once: true
    }
);


window.addEventListener(
    "keydown",
    () => {

        startEngineSound();

    },
    {
        once: true
    }
);


// ============================================================
// STEP 12 HUD
// ============================================================

const hud =
    document.createElement(
        "div"
    );


hud.style.position =
    "fixed";

hud.style.top =
    "18px";

hud.style.left =
    "18px";

hud.style.zIndex =
    "20";

hud.style.padding =
    "14px 18px";

hud.style.borderRadius =
    "12px";

hud.style.background =
    "rgba(0,0,0,0.68)";

hud.style.color =
    "white";

hud.style.fontFamily =
    "Arial, sans-serif";

hud.style.fontSize =
    "15px";

hud.style.lineHeight =
    "1.55";

hud.style.minWidth =
    "225px";

hud.style.backdropFilter =
    "blur(5px)";

hud.style.boxShadow =
    "0 4px 18px rgba(0,0,0,0.3)";


hud.innerHTML = `

    <div>
        Level:
        <b id="levelNumber">1</b>
    </div>

    <div>
        World:
        <b id="worldName">
            🌾 COUNTRYSIDE
        </b>
    </div>

    <div>
        Distance:
        <b id="distanceDisplay">0</b>
        m
    </div>

    <div>
        Score:
        <b id="scoreDisplay">0</b>
    </div>

    <div>
        Combo:
        <b id="comboDisplay">
            x1
        </b>
    </div>

    <div>
        Checkpoint:
        <b id="checkpointDisplay">
            #1
        </b>
    </div>

    <div>
        Best Score:
        <b id="bestScoreDisplay">
            ${Math.floor(bestScore)}
        </b>
    </div>

    <div>
        Best Distance:
        <b id="bestDistanceDisplay">
            ${Math.floor(bestDistance)}
        </b>
        m
    </div>

    <div style="
        margin-top:8px;
    ">
        HEALTH
    </div>

    <div style="
        width:100%;
        height:11px;
        background:#5b1d1d;
        border-radius:8px;
        overflow:hidden;
    ">

        <div
            id="healthBar"
            style="
                width:100%;
                height:100%;
                background:#2ecc71;
                transition:width .15s;
            "
        ></div>

    </div>

    <div style="
        margin-top:7px;
    ">
        NITRO
    </div>

    <div style="
        width:100%;
        height:11px;
        background:#163247;
        border-radius:8px;
        overflow:hidden;
    ">

        <div
            id="nitroBar"
            style="
                width:100%;
                height:100%;
                background:#00c8ff;
                transition:width .08s;
            "
        ></div>

    </div>

    <div style="
        margin-top:9px;
        font-size:12px;
        opacity:.8;
    ">
        SHIFT = Nitro &nbsp; | &nbsp; P = Pause
    </div>

`;


document.body.appendChild(
    hud
);


// ============================================================
// HUD REFERENCES
// ============================================================

const levelNumberDisplay =
    document.getElementById(
        "levelNumber"
    );


const worldNameDisplay =
    document.getElementById(
        "worldName"
    );


const distanceDisplay =
    document.getElementById(
        "distanceDisplay"
    );


const scoreDisplay =
    document.getElementById(
        "scoreDisplay"
    );


const comboDisplay =
    document.getElementById(
        "comboDisplay"
    );


const checkpointDisplay =
    document.getElementById(
        "checkpointDisplay"
    );


const bestScoreDisplay =
    document.getElementById(
        "bestScoreDisplay"
    );


const bestDistanceDisplay =
    document.getElementById(
        "bestDistanceDisplay"
    );


const healthBar =
    document.getElementById(
        "healthBar"
    );


const nitroBar =
    document.getElementById(
        "nitroBar"
    );


const speedDisplay =
    document.getElementById(
        "speed"
    );


// ============================================================
// LEVEL BANNER
// ============================================================

const levelBanner =
    document.createElement(
        "div"
    );


levelBanner.style.position =
    "fixed";

levelBanner.style.top =
    "20%";

levelBanner.style.left =
    "50%";

levelBanner.style.transform =
    "translate(-50%, -50%)";

levelBanner.style.zIndex =
    "30";

levelBanner.style.color =
    "white";

levelBanner.style.fontFamily =
    "Arial, sans-serif";

levelBanner.style.fontWeight =
    "bold";

levelBanner.style.fontSize =
    "34px";

levelBanner.style.textAlign =
    "center";

levelBanner.style.textShadow =
    "0 3px 8px black";

levelBanner.style.opacity =
    "0";

levelBanner.style.transition =
    "opacity .25s";


document.body.appendChild(
    levelBanner
);


// ============================================================
// CENTER MESSAGE
// Used for near misses, checkpoints and warnings.
// ============================================================

const centerMessage =
    document.createElement(
        "div"
    );


centerMessage.style.position =
    "fixed";

centerMessage.style.top =
    "32%";

centerMessage.style.left =
    "50%";

centerMessage.style.transform =
    "translate(-50%, -50%)";

centerMessage.style.zIndex =
    "35";

centerMessage.style.fontFamily =
    "Arial, sans-serif";

centerMessage.style.fontSize =
    "30px";

centerMessage.style.fontWeight =
    "bold";

centerMessage.style.color =
    "#ffffff";

centerMessage.style.textAlign =
    "center";

centerMessage.style.textShadow =
    "0 3px 10px #000";

centerMessage.style.pointerEvents =
    "none";

centerMessage.style.opacity =
    "0";


document.body.appendChild(
    centerMessage
);


// ============================================================
// COUNTDOWN SCREEN
// ============================================================

const countdownScreen =
    document.createElement(
        "div"
    );


countdownScreen.style.position =
    "fixed";

countdownScreen.style.inset =
    "0";

countdownScreen.style.zIndex =
    "100";

countdownScreen.style.display =
    "flex";

countdownScreen.style.alignItems =
    "center";

countdownScreen.style.justifyContent =
    "center";

countdownScreen.style.pointerEvents =
    "none";

countdownScreen.style.fontFamily =
    "Arial, sans-serif";

countdownScreen.style.fontSize =
    "110px";

countdownScreen.style.fontWeight =
    "900";

countdownScreen.style.color =
    "white";

countdownScreen.style.textShadow =
    "0 5px 20px black";


countdownScreen.textContent =
    "3";


document.body.appendChild(
    countdownScreen
);


// ============================================================
// PAUSE SCREEN
// ============================================================

const pauseScreen =
    document.createElement(
        "div"
    );


pauseScreen.style.position =
    "fixed";

pauseScreen.style.top =
    "50%";

pauseScreen.style.left =
    "50%";

pauseScreen.style.transform =
    "translate(-50%, -50%)";

pauseScreen.style.zIndex =
    "100";

pauseScreen.style.padding =
    "30px 50px";

pauseScreen.style.background =
    "rgba(0,0,0,.82)";

pauseScreen.style.borderRadius =
    "16px";

pauseScreen.style.color =
    "white";

pauseScreen.style.fontFamily =
    "Arial, sans-serif";

pauseScreen.style.fontSize =
    "38px";

pauseScreen.style.fontWeight =
    "bold";

pauseScreen.style.textAlign =
    "center";

pauseScreen.style.display =
    "none";


pauseScreen.innerHTML = `

    PAUSED

    <div style="
        font-size:16px;
        margin-top:12px;
        font-weight:normal;
    ">
        Press P to Resume
    </div>

`;


document.body.appendChild(
    pauseScreen
);


// ============================================================
// GAME OVER SCREEN
// ============================================================

const gameOverScreen =
    document.createElement(
        "div"
    );


gameOverScreen.style.position =
    "fixed";

gameOverScreen.style.top =
    "50%";

gameOverScreen.style.left =
    "50%";

gameOverScreen.style.transform =
    "translate(-50%, -50%)";

gameOverScreen.style.zIndex =
    "110";

gameOverScreen.style.padding =
    "30px 55px";

gameOverScreen.style.borderRadius =
    "18px";

gameOverScreen.style.background =
    "rgba(0,0,0,.86)";

gameOverScreen.style.color =
    "white";

gameOverScreen.style.fontFamily =
    "Arial, sans-serif";

gameOverScreen.style.fontSize =
    "20px";

gameOverScreen.style.textAlign =
    "center";

gameOverScreen.style.display =
    "none";


document.body.appendChild(
    gameOverScreen
);


// ============================================================
// FLASH EFFECT FOR DAMAGE
// ============================================================

const damageFlash =
    document.createElement(
        "div"
    );


damageFlash.style.position =
    "fixed";

damageFlash.style.inset =
    "0";

damageFlash.style.zIndex =
    "90";

damageFlash.style.pointerEvents =
    "none";

damageFlash.style.background =
    "rgba(255,0,0,0)";


document.body.appendChild(
    damageFlash
);


// ============================================================
// SHOW LEVEL BANNER
// ============================================================

function showLevelBanner() {

    const level =
        LEVELS[
            currentLevel - 1
        ];


    levelBanner.innerHTML = `

        ${level.icon}
        ${level.name}

        <div style="
            font-size:15px;
            margin-top:6px;
        ">
            LEVEL ${
                currentLevel +
                completedCycles * 5
            }
        </div>

    `;


    levelBanner.style.opacity =
        "1";


    setTimeout(
        () => {

            levelBanner.style.opacity =
                "0";

        },
        1800
    );

}


// ============================================================
// SHOW CENTER MESSAGE
// ============================================================

let centerMessageTimeout =
    null;


function showCenterMessage(
    text,
    color = "#ffffff",
    duration = 1000
) {

    if (
        centerMessageTimeout
    ) {

        clearTimeout(
            centerMessageTimeout
        );

    }


    centerMessage.innerHTML =
        text;


    centerMessage.style.color =
        color;


    centerMessage.style.opacity =
        "1";


    centerMessageTimeout =
        setTimeout(
            () => {

                centerMessage.style.opacity =
                    "0";

            },
            duration
        );

}


// ============================================================
// NEAR MISS
// ============================================================

function showNearMiss() {

    showCenterMessage(

        `NEAR MISS!<br>
        <span style="font-size:18px">
            COMBO x${combo}
        </span>`,

        "#ffe600",

        850

    );

}


// ============================================================
// COMBO SYSTEM
// ============================================================

function addComboEvent(
    basePoints,
    label
) {

    combo =
        Math.min(
            combo + 1,
            10
        );


    comboTimer =
        5;


    const points =
        Math.round(
            basePoints *
            combo
        );


    score +=
        points;


    showCenterMessage(

        `${label}<br>
        <span style="font-size:18px">
            +${points} &nbsp; COMBO x${combo}
        </span>`,

        "#ffe600",

        850

    );

}


// ============================================================
// CHECKPOINT SYSTEM
// ============================================================

function updateCheckpoints() {

    if (
        worldDistance <
        nextCheckpoint
    ) {

        return;

    }


    const checkpointBonus =
        500 *
        checkpointNumber *
        Math.max(
            1,
            combo
        );


    score +=
        checkpointBonus;


    // Small reward for reaching checkpoint

    nitro =
        Math.min(
            100,
            nitro + 30
        );


    health =
        Math.min(
            100,
            health + 10
        );


    showCenterMessage(

        `🏁 CHECKPOINT ${checkpointNumber}<br>
        <span style="font-size:20px">
            +${checkpointBonus} SCORE
        </span>`,

        "#00ffb7",

        1600

    );


    checkpointNumber++;


    nextCheckpoint +=
        1000;


    checkpointDisplay.textContent =
        "#" +
        checkpointNumber;

}


// ============================================================
// HIGH-SPEED SCORE BONUS
// ============================================================

function updateSpeedBonus(
    deltaTime
) {

    if (
        speed >= 750
    ) {

        score +=
            30 *
            deltaTime *
            combo;

    }

    else if (
        speed >= 650
    ) {

        score +=
            18 *
            deltaTime *
            combo;

    }

    else if (
        speed >= 500
    ) {

        score +=
            9 *
            deltaTime *
            combo;

    }

}


// ============================================================
// COMBO TIMER
// ============================================================

function updateCombo(
    deltaTime
) {

    if (
        combo <= 1
    ) {

        combo =
            1;

        return;

    }


    comboTimer -=
        deltaTime;


    if (
        comboTimer <= 0
    ) {

        combo =
            1;

        comboTimer =
            0;

    }

}


// ============================================================
// ROAD WARNING SYSTEM
// ============================================================

let lastWarningKey =
    "";


function updateRoadWarnings() {

    if (
        warningTimer > 0
    ) {

        return;

    }


    const current =
        getRoadData(
            worldDistance
        );


    const aheadDistance =
        worldDistance + 180;


    const ahead =
        getRoadData(
            aheadDistance
        );


    const levelNow =
        current.level;


    const levelAhead =
        ahead.level;


    let warning =
        "";

    let warningKey =
        "";


    // ----------------------------------------
    // WORLD WARNINGS
    // ----------------------------------------

    if (
        levelNow !== 4 &&
        levelAhead === 4
    ) {

        warning =
            "🚇 TUNNEL AHEAD";

        warningKey =
            "tunnel-" +
            completedCycles;

    }


    else if (
        levelNow !== 5 &&
        levelAhead === 5
    ) {

        warning =
            "🌉 BRIDGE AHEAD";

        warningKey =
            "bridge-" +
            completedCycles;

    }


    else {

        const headingDifference =

            ahead.heading -
            current.heading;


        if (
            headingDifference >
            0.025
        ) {

            warning =
                "⚠ SHARP LEFT";

            warningKey =
                "left-" +
                Math.floor(
                    worldDistance /
                    300
                );

        }


        else if (
            headingDifference <
            -0.025
        ) {

            warning =
                "⚠ SHARP RIGHT";

            warningKey =
                "right-" +
                Math.floor(
                    worldDistance /
                    300
                );

        }

    }


    if (

        warning &&

        warningKey !==
        lastWarningKey

    ) {

        lastWarningKey =
            warningKey;


        warningTimer =
            3;


        showCenterMessage(

            warning,

            "#ffb300",

            1300

        );

    }

}


// ============================================================
// UPDATE WARNING TIMER
// ============================================================

function updateWarningTimer(
    deltaTime
) {

    if (
        warningTimer > 0
    ) {

        warningTimer -=
            deltaTime;

    }

}


// ============================================================
// DAMAGE FLASH
// ============================================================

function flashDamage() {

    damageFlash.style.background =
        "rgba(255,0,0,.32)";


    setTimeout(
        () => {

            damageFlash.style.background =
                "rgba(255,0,0,0)";

        },
        130
    );

}


// ============================================================
// DAMAGE SYSTEM
// ============================================================

function damageBike(
    amount,
    major = false
) {

    if (

        collisionCooldown > 0 ||

        gameOver

    ) {

        return;

    }


    collisionCooldown =
        1.2;


    health -=
        amount;


    health =
        Math.max(
            0,
            health
        );


    combo =
        1;


    comboTimer =
        0;


    cameraShake =
        major
            ? 1.4
            : 0.7;


    flashDamage();


    speed *=
        major
            ? 0.35
            : 0.62;


    if (
        health <= 0
    ) {

        crash();

        return;

    }


    showCenterMessage(

        major
            ? `💥 HEAVY HIT!<br>
               <span style="font-size:18px">
                   HEALTH ${Math.round(health)}%
               </span>`

            : `⚠ COLLISION!<br>
               <span style="font-size:18px">
                   HEALTH ${Math.round(health)}%
               </span>`,

        "#ff5555",

        900

    );

}


// ============================================================
// COLLISION COOLDOWN
// ============================================================

function updateCollisionCooldown(
    deltaTime
) {

    if (
        collisionCooldown > 0
    ) {

        collisionCooldown -=
            deltaTime;

    }

}


// ============================================================
// NITRO
// ============================================================

function updateNitro(
    deltaTime
) {

    const wantsNitro =
    (
        keys["shift"] ||
        keys["shiftleft"] ||
        keys["shiftright"]
    ) &&
    (
        keys["w"] ||
        keys["arrowup"]
    );


    nitroActive =

        Boolean(
            wantsNitro
        ) &&

        nitro > 0 &&

        speed > 80 &&

        !gameOver &&

        !paused &&

        !countdownActive;


    if (
        nitroActive
    ) {

        nitro -=
            24 *
            deltaTime;


        nitro =
            Math.max(
                0,
                nitro
            );


        speed +=
            115 *
            deltaTime;


        speed =
            Math.min(
                speed,
                NITRO_MAX_SPEED
            );


        cameraShake =
            Math.max(
                cameraShake,
                0.10
            );

    }


    else {

        // Slow automatic recharge.

        nitro +=
            5.5 *
            deltaTime;


        nitro =
            Math.min(
                100,
                nitro
            );

    }

}


// ============================================================
// COUNTDOWN
// ============================================================

function updateCountdown(
    deltaTime
) {

    if (
        !countdownActive
    ) {

        return;

    }


    countdownTime -=
        deltaTime;


    if (
        countdownTime > 3
    ) {

        countdownScreen.textContent =
            "3";

    }


    else if (
        countdownTime > 2
    ) {

        countdownScreen.textContent =
            "3";

    }


    else if (
        countdownTime > 1
    ) {

        countdownScreen.textContent =
            "2";

    }


    else if (
        countdownTime > 0
    ) {

        countdownScreen.textContent =
            "1";

    }


    else if (
        countdownTime > -0.8
    ) {

        countdownScreen.textContent =
            "GO!";

    }


    else {

        countdownActive =
            false;


        raceStarted =
            true;


        countdownScreen.style.display =
            "none";


        clock.getDelta();

    }

}


// ============================================================
// UPDATE HUD
// ============================================================

function updateHUD() {

    distanceDisplay.textContent =
        Math.floor(
            worldDistance
        );


    scoreDisplay.textContent =
        Math.floor(
            score
        );


    comboDisplay.textContent =
        "x" +
        combo;


    checkpointDisplay.textContent =
        "#" +
        checkpointNumber;


    bestScoreDisplay.textContent =
        Math.floor(
            bestScore
        );


    bestDistanceDisplay.textContent =
        Math.floor(
            bestDistance
        );


    healthBar.style.width =
        health + "%";


    nitroBar.style.width =
        nitro + "%";


    // Health color

    if (
        health > 60
    ) {

        healthBar.style.background =
            "#2ecc71";

    }

    else if (
        health > 30
    ) {

        healthBar.style.background =
            "#f1c40f";

    }

    else {

        healthBar.style.background =
            "#e53935";

    }


    // Nitro glow

    nitroBar.style.boxShadow =

        nitroActive

            ? "0 0 14px #00c8ff"

            : "none";


    // Existing speedometer

    if (
        speedDisplay
    ) {

        speedDisplay.textContent =
            Math.round(
                speed
            );

    }

}


// ============================================================
// SAVE BEST RECORDS
// ============================================================

function saveBestRecords() {

    if (
        score >
        bestScore
    ) {

        bestScore =
            Math.floor(
                score
            );


        localStorage.setItem(

            "bikeGameBestScore",

            String(
                bestScore
            )

        );

    }


    if (
        worldDistance >
        bestDistance
    ) {

        bestDistance =
            Math.floor(
                worldDistance
            );


        localStorage.setItem(

            "bikeGameBestDistance",

            String(
                bestDistance
            )

        );

    }

}


// ============================================================
// ENGINE SOUND
// ============================================================

let audioContext =
    null;

let engineOscillator =
    null;

let engineOscillator2 =
    null;

let engineGain =
    null;

let engineStarted =
    false;


// ============================================================
// START ENGINE SOUND
// ============================================================

function startEngineSound() {

    if (
        engineStarted
    ) {

        if (
            audioContext &&
            audioContext.state ===
            "suspended"
        ) {

            audioContext.resume();

        }

        return;

    }


    const AudioContextClass =

        window.AudioContext ||

        window.webkitAudioContext;


    if (
        !AudioContextClass
    ) {

        return;

    }


    audioContext =
        new AudioContextClass();


    engineGain =
        audioContext.createGain();


    engineGain.gain.value =
        0.0001;


    engineGain.connect(
        audioContext.destination
    );


    engineOscillator =
        audioContext.createOscillator();


    engineOscillator.type =
        "sawtooth";


    engineOscillator.frequency.value =
        55;


    engineOscillator.connect(
        engineGain
    );


    engineOscillator.start();


    engineOscillator2 =
        audioContext.createOscillator();


    engineOscillator2.type =
        "square";


    engineOscillator2.frequency.value =
        27;


    const secondGain =
        audioContext.createGain();


    secondGain.gain.value =
        0.16;


    engineOscillator2.connect(
        secondGain
    );


    secondGain.connect(
        engineGain
    );


    engineOscillator2.start();


    engineStarted =
        true;

}


// ============================================================
// UPDATE ENGINE SOUND
// ============================================================

function updateEngineSound() {

    if (

        !engineStarted ||

        !audioContext

    ) {

        return;

    }


    const speedFactor =
        speed /
        NITRO_MAX_SPEED;


    const frequency =
        55 +
        speedFactor *
        210 +
        (
            nitroActive
                ? 35
                : 0
        );


    engineOscillator.frequency.setTargetAtTime(

        frequency,

        audioContext.currentTime,

        0.05

    );


    engineOscillator2.frequency.setTargetAtTime(

        frequency * 0.5,

        audioContext.currentTime,

        0.06

    );


    let volume =
        0.018 +
        speedFactor *
        0.065;


    if (
        nitroActive
    ) {

        volume +=
            0.018;

    }


    if (
        paused ||
        countdownActive
    ) {

        volume =
            0.008;

    }


    engineGain.gain.setTargetAtTime(

        volume,

        audioContext.currentTime,

        0.08

    );

}

// ============================================================
// SPEED / ACCELERATION
// ============================================================

function updateSpeed(deltaTime) {

    if (
        gameOver ||
        paused ||
        countdownActive
    ) {
        return;
    }

    // Nitro is handled separately.
    // Normal engine speed is limited to 800 km/h.

    if (
        keys["w"] ||
        keys["arrowup"]
    ) {

        const factor =
            THREE.MathUtils.lerp(
                1,
                0.30,
                Math.min(
                    speed / MAX_SPEED,
                    1
                )
            );

        speed +=
            52 *
            factor *
            deltaTime;

    }

    else if (
        keys["s"] ||
        keys["arrowdown"]
    ) {

        speed -=
            135 *
            deltaTime;

    }

    else {

        speed -=
            6 *
            deltaTime;

    }


    // When Nitro is not active,
    // gradually return from >800 km/h.

    if (
        !nitroActive &&
        speed > MAX_SPEED
    ) {

        speed -=
            70 *
            deltaTime;

    }


    speed =
        THREE.MathUtils.clamp(
            speed,
            0,
            nitroActive
                ? NITRO_MAX_SPEED
                : Math.max(
                    MAX_SPEED,
                    speed
                )
        );

}


// ============================================================
// WORLD DISTANCE
// ============================================================

function updateWorldDistance(deltaTime) {

    if (
        gameOver ||
        paused ||
        countdownActive
    ) {
        return;
    }


    const metresPerSecond =
        speed / 3.6;


    worldDistance +=
        metresPerSecond *
        deltaTime;


    score +=
        metresPerSecond *
        deltaTime *
        0.12 *
        Math.max(
            1,
            combo * 0.35
        );

}


// ============================================================
// BIKE CONTROL
// ============================================================

function updateBike(deltaTime) {

    if (
        gameOver
    ) {
        return;
    }


    const speedFactor =
        THREE.MathUtils.clamp(
            speed / MAX_SPEED,
            0,
            1
        );


    const steeringSpeed =
        THREE.MathUtils.lerp(
            9,
            4.8,
            speedFactor
        );


    let steer =
        0;


    if (
        !paused &&
        !countdownActive
    ) {

        if (
            keys["a"] ||
            keys["arrowleft"]
        ) {

            bikeLaneOffset -=
                steeringSpeed *
                deltaTime;

            steer =
                -1;

        }


        if (
            keys["d"] ||
            keys["arrowright"]
        ) {

            bikeLaneOffset +=
                steeringSpeed *
                deltaTime;

            steer =
                1;

        }

    }


    bikeLaneOffset =
        THREE.MathUtils.clamp(
            bikeLaneOffset,
            -10.5,
            10.5
        );


    const roadData =
        getRoadData(
            worldDistance
        );


    bike.position.x =
        roadData.x +
        bikeLaneOffset;


    bike.position.y =
        roadData.y +
        0.08;


    bike.position.z =
        PLAYER_Z;


    bike.rotation.y =
        THREE.MathUtils.lerp(
            bike.rotation.y,
            -roadData.heading,
            0.10
        );


    bike.rotation.x =
        THREE.MathUtils.lerp(
            bike.rotation.x,
            roadData.pitch,
            0.08
        );


    const roadLean =
        THREE.MathUtils.clamp(
            roadData.heading * 2,
            -0.18,
            0.18
        );


    const steeringLean =
        steer *
        -0.28;


    bike.rotation.z =
        THREE.MathUtils.lerp(
            bike.rotation.z,
            roadLean +
            steeringLean,
            0.12
        );

}


// ============================================================
// BIKE WHEELS
// ============================================================

function updateBikeWheels(deltaTime) {

    const rotation =
        speed *
        deltaTime *
        0.06;


    bikeModelWheels.forEach(
        wheel => {

            wheel.rotation.x -=
                rotation;

        }
    );

}


// ============================================================
// RIDER TUCK
// ============================================================

function updateRider() {

    if (
        gameOver
    ) {
        return;
    }


    const factor =
        THREE.MathUtils.clamp(
            speed /
            NITRO_MAX_SPEED,
            0,
            1
        );


    riderGroup.rotation.x =
        THREE.MathUtils.lerp(
            riderGroup.rotation.x,
            -0.13 *
            factor,
            0.04
        );


    riderGroup.position.y =
        THREE.MathUtils.lerp(
            riderGroup.position.y,
            -0.12 -
            factor *
            0.08,
            0.04
        );

}


// ============================================================
// DIFFICULTY
// ============================================================

function getDifficulty() {

    return THREE.MathUtils.clamp(

        (
            speed /
            MAX_SPEED
        ) +

        (
            currentLevel -
            1
        ) *
        0.08 +

        completedCycles *
        0.08 +

        (
            worldDistance /
            25000
        ),

        0,

        2.1

    );

}


// ============================================================
// TRAFFIC LANE CHANGE
// ============================================================

function chooseTrafficLane(vehicle) {

    const positions =

        vehicle.direction ===
        "same"

            ? sameTrafficPositions

            : oncomingTrafficPositions;


    const newLane =

        positions[

            Math.floor(
                Math.random() *
                positions.length
            )

        ];


    // IMPORTANT:
    // Do not let traffic suddenly swerve
    // into the player at close range.

    if (
        vehicle.distanceAhead <
        55 &&

        vehicle.distanceAhead >
        -20 &&

        Math.abs(
            newLane -
            bikeLaneOffset
        ) <
        2.2
    ) {

        return;

    }


    vehicle.targetLaneOffset =
        newLane;

}


// ============================================================
// RECYCLE TRAFFIC
//
// IMPORTANT FIX FROM STEP 11:
//
// previousDistanceAhead MUST be reset after teleport.
// Otherwise swept collision can create a false crash.
// ============================================================

function recycleTraffic(vehicle) {

    const difficulty =
        getDifficulty();


    vehicle.distanceAhead =

        480 +

        Math.random() *

        Math.max(
            300,
            720 -
            difficulty *
            140
        );


    // CRITICAL FALSE-CRASH FIX

    vehicle.previousDistanceAhead =
        vehicle.distanceAhead;


    const positions =

        vehicle.direction ===
        "same"

            ? sameTrafficPositions

            : oncomingTrafficPositions;


    vehicle.laneOffset =

        positions[

            Math.floor(
                Math.random() *
                positions.length
            )

        ];


    vehicle.targetLaneOffset =
        vehicle.laneOffset;


    vehicle.passed =
        false;


    vehicle.nearMiss =
        false;


    // Increase traffic speed gradually.

    if (
        vehicle.direction ===
        "same"
    ) {

        vehicle.vehicleSpeed =

            vehicle.truck

                ? 85 +
                  Math.random() * 70

                : 110 +
                  Math.random() * 140;

    }

    else {

        vehicle.vehicleSpeed =

            vehicle.truck

                ? 90 +
                  Math.random() * 80

                : 120 +
                  Math.random() * 160;

    }

}


// ============================================================
// TRAFFIC UPDATE
// ============================================================

function updateTraffic(deltaTime) {

    if (
        gameOver ||
        paused ||
        countdownActive
    ) {
        return;
    }


    const playerMps =
        speed / 3.6;


    const difficulty =
        getDifficulty();


    traffic.forEach(
        vehicle => {

            vehicle.previousDistanceAhead =
                vehicle.distanceAhead;


            const vehicleMps =
                vehicle.vehicleSpeed /
                3.6;


            // ----------------------------------------
            // SAME DIRECTION
            // ----------------------------------------

            if (
                vehicle.direction ===
                "same"
            ) {

                vehicle.distanceAhead +=

                    (
                        vehicleMps -
                        playerMps
                    ) *

                    deltaTime;

            }


            // ----------------------------------------
            // ONCOMING
            // ----------------------------------------

            else {

                vehicle.distanceAhead -=

                    (
                        vehicleMps +
                        playerMps
                    ) *

                    deltaTime;

            }


            // ----------------------------------------
            // SMOOTH LANE CHANGING
            // ----------------------------------------

            vehicle.laneOffset =
                THREE.MathUtils.lerp(

                    vehicle.laneOffset,

                    vehicle.targetLaneOffset,

                    Math.min(
                        1,

                        (
                            0.42 +
                            difficulty *
                            0.20
                        ) *

                        deltaTime
                    )

                );


            // ----------------------------------------
            // RANDOM LANE CHANGES
            // ----------------------------------------

            const laneChangeRate =
                0.022 +
                difficulty *
                0.030;


            if (
                Math.random() <
                laneChangeRate *
                deltaTime
            ) {

                chooseTrafficLane(
                    vehicle
                );

            }


            // ----------------------------------------
            // OVERTAKE COMBO
            // ----------------------------------------

            if (
                vehicle.direction ===
                "same" &&

                vehicle.previousDistanceAhead >=
                0 &&

                vehicle.distanceAhead <
                0 &&

                !vehicle.passed
            ) {

                vehicle.passed =
                    true;


                addComboEvent(

                    vehicle.truck
                        ? 150
                        : 80,

                    vehicle.truck
                        ? "TRUCK OVERTAKE!"
                        : "OVERTAKE!"

                );

            }


            // ----------------------------------------
            // ONCOMING NEAR MISS
            // ----------------------------------------

            if (
                vehicle.direction ===
                "oncoming"
            ) {

                const lateralDifference =
                    Math.abs(
                        bikeLaneOffset -
                        vehicle.laneOffset
                    );


                const crossed =

                    vehicle.previousDistanceAhead >
                    0 &&

                    vehicle.distanceAhead <=
                    0;


                if (
                    crossed &&

                    lateralDifference >
                    1.5 &&

                    lateralDifference <
                    2.9 &&

                    !vehicle.nearMiss
                ) {

                    vehicle.nearMiss =
                        true;


                    addComboEvent(
                        100,
                        "NEAR MISS!"
                    );

                }

            }


            // ----------------------------------------
            // RECYCLE
            // ----------------------------------------

            if (
                vehicle.distanceAhead <
                -80
            ) {

                recycleTraffic(
                    vehicle
                );

            }


            if (
                vehicle.distanceAhead >
                1200
            ) {

                recycleTraffic(
                    vehicle
                );

            }


            // ----------------------------------------
            // POSITION VEHICLE ON CURVED ROAD
            // ----------------------------------------

            const absoluteDistance =

                worldDistance +
                vehicle.distanceAhead;


            const roadData =
                getRoadData(
                    absoluteDistance
                );


            vehicle.object.position.set(

                roadData.x +
                vehicle.laneOffset,

                roadData.y,

                PLAYER_Z -
                vehicle.distanceAhead

            );


            vehicle.object.rotation.x =
                roadData.pitch;


            if (
                vehicle.direction ===
                "same"
            ) {

                vehicle.object.rotation.y =
                    -roadData.heading;

            }

            else {

                vehicle.object.rotation.y =
                    Math.PI -
                    roadData.heading;

            }


            // ----------------------------------------
            // WHEELS
            // ----------------------------------------

            const wheelRotation =
                vehicle.vehicleSpeed *
                deltaTime *
                0.06;


            vehicle.wheels.forEach(
                wheel => {

                    wheel.rotation.x -=
                        wheelRotation;

                }
            );

        }
    );

}


// ============================================================
// OBSTACLE UPDATE
// ============================================================

function updateObstacles(deltaTime) {

    if (
        gameOver ||
        paused ||
        countdownActive
    ) {
        return;
    }


    const playerMps =
        speed /
        3.6;


    const possibleLanes = [

        -9,

        -6,

        -3,

        -1.05,

        1.05,

        3,

        6,

        9

    ];


    obstacles.forEach(
        obstacle => {

            obstacle.previousDistanceAhead =
                obstacle.distanceAhead;


            obstacle.distanceAhead -=
                playerMps *
                deltaTime;


            // ----------------------------------------
            // RECYCLE OBSTACLE
            // ----------------------------------------

            if (
                obstacle.distanceAhead <
                -50
            ) {

                obstacle.distanceAhead =

                    480 +

                    Math.random() *
                    700;


                // Same swept-collision protection.

                obstacle.previousDistanceAhead =
                    obstacle.distanceAhead;


                obstacle.laneOffset =

                    possibleLanes[

                        Math.floor(

                            Math.random() *

                            possibleLanes.length

                        )

                    ];

            }


            const absoluteDistance =

                worldDistance +
                obstacle.distanceAhead;


            const roadData =
                getRoadData(
                    absoluteDistance
                );


            obstacle.object.position.set(

                roadData.x +
                obstacle.laneOffset,

                roadData.y,

                PLAYER_Z -
                obstacle.distanceAhead

            );


            obstacle.object.rotation.y =
                -roadData.heading;


            obstacle.object.rotation.x =
                roadData.pitch;

        }
    );

}


// ============================================================
// SWEPT COLLISION
//
// Essential at 800-900 km/h.
// ============================================================

function crossedPlayer(
    previousDistance,
    currentDistance,
    length
) {

    // Normal overlap.

    if (
        Math.abs(
            currentDistance
        ) <=
        length
    ) {

        return true;

    }


    // Crossed completely between frames.

    if (
        previousDistance >
        length &&

        currentDistance <
        -length
    ) {

        return true;

    }


    if (
        previousDistance <
        -length &&

        currentDistance >
        length
    ) {

        return true;

    }


    return false;

}


// ============================================================
// COLLISION CHECK
// ============================================================

function checkCollision() {

    if (
        gameOver ||
        paused ||
        countdownActive ||
        collisionCooldown > 0
    ) {

        return;

    }


    // ========================================================
    // TRAFFIC COLLISION
    // ========================================================

    for (
        const vehicle of traffic
    ) {

        const dx =
            Math.abs(
                bikeLaneOffset -
                vehicle.laneOffset
            );


        const width =
            vehicle.truck
                ? 1.9
                : 1.45;


        const length =
            vehicle.truck
                ? 4.2
                : 2.7;


        if (
            dx <
            width &&

            crossedPlayer(

                vehicle.previousDistanceAhead,

                vehicle.distanceAhead,

                length

            )
        ) {

            // Head-on traffic is much more severe.

            const headOn =
                vehicle.direction ===
                "oncoming";


            const veryFast =
                speed >
                650;


            if (
                headOn &&
                veryFast
            ) {

                damageBike(
                    100,
                    true
                );

            }

            else if (
                headOn
            ) {

                damageBike(
                    65,
                    true
                );

            }

            else if (
                vehicle.truck
            ) {

                damageBike(
                    50,
                    true
                );

            }

            else {

                damageBike(
                    speed > 500
                        ? 45
                        : 30,

                    speed > 500

                );

            }


            // Move vehicle away after impact
            // so cooldown doesn't end while still overlapping.

            vehicle.distanceAhead =
                80 +
                Math.random() *
                120;


            vehicle.previousDistanceAhead =
                vehicle.distanceAhead;


            return;

        }

    }


    // ========================================================
    // OBSTACLE COLLISION
    // ========================================================

    for (
        const obstacle of obstacles
    ) {

        const dx =
            Math.abs(
                bikeLaneOffset -
                obstacle.laneOffset
            );


        const width =

            obstacle.type ===
            "barrier"

                ? 1.2

                : 0.55;


        const length =

            obstacle.type ===
            "barrier"

                ? 1

                : 0.7;


        if (
            dx <
            width &&

            crossedPlayer(

                obstacle.previousDistanceAhead,

                obstacle.distanceAhead,

                length

            )
        ) {

            damageBike(

                obstacle.type ===
                "barrier"

                    ? 40

                    : 20,

                obstacle.type ===
                "barrier"

            );


            // Safely recycle obstacle after hit.

            obstacle.distanceAhead =
                550 +
                Math.random() *
                500;


            obstacle.previousDistanceAhead =
                obstacle.distanceAhead;


            return;

        }

    }

}


// ============================================================
// LEVEL UPDATE
// ============================================================

function updateLevel() {

    const newLevel =
        getLevelFromDistance(
            worldDistance
        );


    const newCycles =
        Math.floor(
            worldDistance /
            WORLD_LENGTH
        );


    if (
        newCycles !==
        completedCycles
    ) {

        completedCycles =
            newCycles;

    }


    if (
        newLevel !==
        currentLevel
    ) {

        currentLevel =
            newLevel;


        applyEnvironment();


        showLevelBanner();

    }

}


// ============================================================
// ENVIRONMENT
// ============================================================

function applyEnvironment() {

    const level =
        LEVELS[
            currentLevel -
            1
        ];


    worldNameDisplay.textContent =
        `${level.icon} ${level.name}`;


    levelNumberDisplay.textContent =

        currentLevel +

        completedCycles *
        5;


    // ========================================================
    // COUNTRYSIDE
    // ========================================================

    if (
        currentLevel ===
        1
    ) {

        scene.background.set(
            0x91cbea
        );


        scene.fog.color.set(
            0x91cbea
        );


        scene.fog.near =
            140;


        scene.fog.far =
            900;


        groundMaterial.color.set(
            0x648f45
        );


        sunlight.intensity =
            3.5;


        hemisphereLight.intensity =
            1.8;


        ambientLight.intensity =
            0.42;


        renderer.toneMappingExposure =
            1.3;


        sun.visible =
            true;

    }


    // ========================================================
    // CITY
    // ========================================================

    else if (
        currentLevel ===
        2
    ) {

        scene.background.set(
            0x8fb6ca
        );


        scene.fog.color.set(
            0x8fb6ca
        );


        scene.fog.near =
            120;


        scene.fog.far =
            750;


        groundMaterial.color.set(
            0x70736f
        );


        sunlight.intensity =
            3.0;


        hemisphereLight.intensity =
            1.5;


        ambientLight.intensity =
            0.48;


        renderer.toneMappingExposure =
            1.25;


        sun.visible =
            true;

    }


    // ========================================================
    // MOUNTAINS
    // ========================================================

    else if (
        currentLevel ===
        3
    ) {

        scene.background.set(
            0x9bb8c8
        );


        scene.fog.color.set(
            0x9bb8c8
        );


        scene.fog.near =
            110;


        scene.fog.far =
            700;


        groundMaterial.color.set(
            0x526b42
        );


        sunlight.intensity =
            2.8;


        hemisphereLight.intensity =
            1.45;


        ambientLight.intensity =
            0.43;


        renderer.toneMappingExposure =
            1.2;


        sun.visible =
            true;

    }


    // ========================================================
    // TUNNEL
    // ========================================================

    else if (
        currentLevel ===
        4
    ) {

        scene.background.set(
            0x15191d
        );


        scene.fog.color.set(
            0x15191d
        );


        scene.fog.near =
            70;


        scene.fog.far =
            420;


        groundMaterial.color.set(
            0x282828
        );


        sunlight.intensity =
            0.15;


        hemisphereLight.intensity =
            0.35;


        ambientLight.intensity =
            0.30;


        renderer.toneMappingExposure =
            0.92;


        sun.visible =
            false;

    }


    // ========================================================
    // MEGA BRIDGE
    // ========================================================

    else {

        scene.background.set(
            0x80c7e8
        );


        scene.fog.color.set(
            0x80c7e8
        );


        scene.fog.near =
            150;


        scene.fog.far =
            1000;


        groundMaterial.color.set(
            0x2c7fa3
        );


        sunlight.intensity =
            3.7;


        hemisphereLight.intensity =
            1.8;


        ambientLight.intensity =
            0.42;


        renderer.toneMappingExposure =
            1.35;


        sun.visible =
            true;

    }

}


// ============================================================
// CRASH
// ============================================================

function crash() {

    if (
        gameOver
    ) {

        return;

    }


    gameOver =
        true;


    nitroActive =
        false;


    crashAnimationTime =
        0;


    cameraShake =
        2;


    saveBestRecords();


    const level =
        LEVELS[
            currentLevel -
            1
        ];


    gameOverScreen.innerHTML = `

        <div style="
            font-size:44px;
            color:#ff4444;
            font-weight:bold;
        ">
            CRASH!
        </div>

        <br>

        ${level.icon}
        ${level.name}

        <br><br>

        Distance:
        <b>${Math.floor(worldDistance)} m</b>

        <br>

        Score:
        <b>${Math.floor(score)}</b>

        <br>

        Best Distance:
        <b>${Math.floor(bestDistance)} m</b>

        <br>

        Best Score:
        <b>${Math.floor(bestScore)}</b>

        <br><br>

        Press
        <b>R</b>
        to Restart

    `;


    // Slight delay allows crash animation
    // to start before overlay appears.

    setTimeout(
        () => {

            if (
                gameOver
            ) {

                gameOverScreen.style.display =
                    "block";

            }

        },
        450
    );

}


// ============================================================
// CRASH ANIMATION
// ============================================================

function updateCrashAnimation(
    deltaTime
) {

    if (
        !gameOver
    ) {

        return;

    }


    crashAnimationTime +=
        deltaTime;


    speed -=
        220 *
        deltaTime;


    speed =
        Math.max(
            0,
            speed
        );


    bike.rotation.z +=
        2.1 *
        deltaTime;


    bike.rotation.x +=
        0.75 *
        deltaTime;


    bike.position.x +=
        3.5 *
        deltaTime;


    cameraShake =
        Math.max(
            cameraShake,
            1.2
        );

}


// ============================================================
// CAMERA
// ============================================================

function updateCamera() {

    const speedFactor =
        THREE.MathUtils.clamp(
            speed /
            NITRO_MAX_SPEED,
            0,
            1
        );


    const roadAhead =
        getRoadData(
            worldDistance +
            70
        );


    const targetCameraX =
        bike.position.x -
        roadAhead.heading *
        7;


    const targetCameraY =
        bike.position.y +
        4.6 +
        speedFactor *
        0.8;


    const targetCameraZ =
        11 +
        speedFactor *
        3;


    camera.position.x =
        THREE.MathUtils.lerp(
            camera.position.x,
            targetCameraX,
            0.08
        );


    camera.position.y =
        THREE.MathUtils.lerp(
            camera.position.y,
            targetCameraY,
            0.08
        );


    camera.position.z =
        THREE.MathUtils.lerp(
            camera.position.z,
            targetCameraZ,
            0.08
        );


    // Look farther ahead at high speed.

    const lookDistance =
        55 +
        speedFactor *
        35;


    const lookData =
        getRoadData(
            worldDistance +
            lookDistance
        );


    camera.lookAt(

        lookData.x +
        bikeLaneOffset *
        0.25,

        lookData.y +
        1.2,

        -lookDistance

    );


    let targetFov;


    if (
        currentLevel ===
        4
    ) {

        targetFov =
            65 +
            speedFactor *
            15;

    }

    else {

        targetFov =
            62 +
            speedFactor *
            24;

    }


    // Nitro gives stronger sense of speed.

    if (
        nitroActive
    ) {

        targetFov +=
            8;

    }


    camera.fov =
        THREE.MathUtils.lerp(
            camera.fov,
            targetFov,
            0.04
        );


    camera.updateProjectionMatrix();

}


// ============================================================
// CAMERA SHAKE / HIGH SPEED VIBRATION
// ============================================================

function updateVibration(
    deltaTime
) {

    let vibration =
        0;


    if (
        speed >
        400 &&
        !paused
    ) {

        const factor =
            speed /
            NITRO_MAX_SPEED;


        vibration +=
            0.004 +
            factor *
            0.012;

    }


    if (
        nitroActive
    ) {

        vibration +=
            0.018;

    }


    if (
        cameraShake >
        0
    ) {

        vibration +=
            cameraShake *
            0.035;


        cameraShake -=
            2.3 *
            deltaTime;


        cameraShake =
            Math.max(
                0,
                cameraShake
            );

    }


    if (
        vibration >
        0
    ) {

        camera.position.x +=

            (
                Math.random() -
                0.5
            ) *

            vibration;


        camera.position.y +=

            (
                Math.random() -
                0.5
            ) *

            vibration;

    }

}


// ============================================================
// RESTART
// ============================================================

function restartGame() {

    speed =
        0;


    worldDistance =
        0;


    score =
        0;


    health =
        100;


    nitro =
        100;


    nitroActive =
        false;


    combo =
        1;


    comboTimer =
        0;


    checkpointNumber =
        1;


    nextCheckpoint =
        1000;


    collisionCooldown =
        0;


    cameraShake =
        0;


    crashAnimationTime =
        0;


    gameOver =
        false;


    paused =
        false;


    currentLevel =
        1;


    completedCycles =
        0;


    bikeLaneOffset =
        -3;


    countdownActive =
        true;


    countdownTime =
        4;


    raceStarted =
        false;


    lastWarningKey =
        "";


    warningTimer =
        0;


    bike.rotation.set(
        0,
        0,
        0
    );


    bike.position.set(
        -3,
        0,
        PLAYER_Z
    );


    riderGroup.rotation.set(
        0,
        0,
        0
    );


    riderGroup.position.set(
        0,
        -0.12,
        0.20
    );


    // ========================================================
    // RESET TRAFFIC
    // ========================================================

    traffic.forEach(
        (vehicle, index) => {

            vehicle.distanceAhead =

                180 +
                index *
                95;


            // CRITICAL:
            // Prevent false swept collision after restart.

            vehicle.previousDistanceAhead =
                vehicle.distanceAhead;


            if (
                vehicle.direction ===
                "same"
            ) {

                vehicle.laneOffset =

                    index %
                    2 ===
                    0

                        ? -9

                        : -3;

            }

            else {

                vehicle.laneOffset =

                    index %
                    2 ===
                    0

                        ? 3

                        : 9;

            }


            vehicle.targetLaneOffset =
                vehicle.laneOffset;


            vehicle.passed =
                false;


            vehicle.nearMiss =
                false;

        }
    );


    // ========================================================
    // RESET OBSTACLES
    // ========================================================

    obstacles.forEach(
        (obstacle, index) => {

            obstacle.distanceAhead =

                280 +
                index *
                150;


            obstacle.previousDistanceAhead =
                obstacle.distanceAhead;

        }
    );


    gameOverScreen.style.display =
        "none";


    pauseScreen.style.display =
        "none";


    countdownScreen.style.display =
        "flex";


    countdownScreen.textContent =
        "3";


    applyEnvironment();


    updateHUD();


    updateRoad();


    updateScenery();


    updateTunnel();


    updateBridge();


    showLevelBanner();


    clock.getDelta();

}


// ============================================================
// INITIAL SETUP
// ============================================================

applyEnvironment();

updateRoad();

updateScenery();

updateTunnel();

updateBridge();

updateHUD();


setTimeout(
    () => {

        showLevelBanner();

    },
    500
);


// ============================================================
// MAIN GAME LOOP
// ============================================================

function animate() {

    requestAnimationFrame(
        animate
    );


    // Prevent huge jumps if browser tab
    // was inactive.

    const deltaTime =
        Math.min(
            clock.getDelta(),
            0.05
        );


    // ========================================================
    // COUNTDOWN
    // ========================================================

    if (
        countdownActive
    ) {

        updateCountdown(
            deltaTime
        );

    }


    // ========================================================
    // PAUSED
    // ========================================================

    if (
        paused
    ) {

        updateEngineSound();

        updateHUD();


        renderer.render(
            scene,
            camera
        );


        return;

    }


    // ========================================================
    // GAME OVER / CRASH
    // ========================================================

    if (
        gameOver
    ) {

        updateCrashAnimation(
            deltaTime
        );


        updateEngineSound();


        updateHUD();


        updateCamera();


        updateVibration(
            deltaTime
        );


        renderer.render(
            scene,
            camera
        );


        return;

    }


    // ========================================================
    // PLAYER SPEED
    // ========================================================

    updateSpeed(
        deltaTime
    );


    // ========================================================
    // NITRO
    // ========================================================

    updateNitro(
        deltaTime
    );


    // ========================================================
    // DISTANCE / SCORE
    // ========================================================

    updateWorldDistance(
        deltaTime
    );


    updateSpeedBonus(
        deltaTime
    );


    // ========================================================
    // LEVEL / CHECKPOINT
    // ========================================================

    updateLevel();


    updateCheckpoints();


    updateRoadWarnings();


    updateWarningTimer(
        deltaTime
    );


    // ========================================================
    // COMBO
    // ========================================================

    updateCombo(
        deltaTime
    );


    // ========================================================
    // COLLISION COOLDOWN
    // ========================================================

    updateCollisionCooldown(
        deltaTime
    );


    // ========================================================
    // BIKE
    // ========================================================

    updateBike(
        deltaTime
    );


    updateBikeWheels(
        deltaTime
    );


    updateRider();


    // ========================================================
    // WORLD
    // ========================================================

    updateRoad();


    updateScenery();


    updateTunnel();


    updateBridge();


    // ========================================================
    // TRAFFIC / OBSTACLES
    // ========================================================

    updateTraffic(
        deltaTime
    );


    updateObstacles(
        deltaTime
    );


    // ========================================================
    // COLLISION
    // ========================================================

    checkCollision();


    // ========================================================
    // BEST RECORDS
    // ========================================================

    if (
        score >
        bestScore
    ) {

        bestScore =
            Math.floor(
                score
            );

    }


    if (
        worldDistance >
        bestDistance
    ) {

        bestDistance =
            Math.floor(
                worldDistance
            );

    }


    // ========================================================
    // AUDIO / HUD
    // ========================================================

    updateEngineSound();


    updateHUD();


    // ========================================================
    // CAMERA
    // ========================================================

    updateCamera();


    updateVibration(
        deltaTime
    );


    // ========================================================
    // RENDER
    // ========================================================

    renderer.render(
        scene,
        camera
    );

}


animate();


// ============================================================
// SAVE BEST SCORE IF PAGE CLOSES
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        saveBestRecords();

    }
);


// ============================================================
// WINDOW RESIZE
// ============================================================

window.addEventListener(
    "resize",
    () => {

        camera.aspect =

            window.innerWidth /
            window.innerHeight;


        camera.updateProjectionMatrix();


        renderer.setSize(

            window.innerWidth,

            window.innerHeight

        );

    }
);