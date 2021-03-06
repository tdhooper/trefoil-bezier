global.THREE = require('three/build/three');
var CANNON = require('cannon');

require('three/examples/js/controls/OrbitControls');

var dt = 1/60, R = 0.2;

const Main = function() {
    this.initThree();
    this.initCanon();
    this.initScene();
    window.addEventListener('resize', this.onResize.bind(this), false);
    this.onResize();
    this.animate();
};

Main.prototype.trefoil = function(a) {
    var pos = new THREE.Vector3(
        Math.sin(a) + 2 * Math.sin(2 * a),
        Math.cos(a) - 2 * Math.cos(2 * a),
        -Math.sin(3 * a)
    );
    // pos.applyAxisAngle(new THREE.Vector3(1,0,0), .1);
    // pos.applyAxisAngle(new THREE.Vector3(0,1,0), .2);
    // pos.applyAxisAngle(new THREE.Vector3(0,0,1), -.1);
    // pos.x += .5;
    // pos.y -= .5;
    // pos.z -= .5;
    return pos;
};

Main.prototype.initScene = function() {
    this.scene = new THREE.Scene();
    this.scene.add(this.camera);

    this.groupZ = new THREE.Group();
    this.groupY = new THREE.Group();
    this.groupX = new THREE.Group();
    this.group = new THREE.Group();

    this.scene.add(this.groupZ);
    this.groupZ.add(this.groupY);
    this.groupY.add(this.groupX);
    this.groupX.add(this.group);

    var axesHelper = new THREE.AxesHelper(1);
    this.scene.add(axesHelper);

    var light = new THREE.PointLight( 0xffffff, 2, 100 );
    light.position.set( -5, 5, 5 );
    this.camera.add(light);

    var ambient = new THREE.AmbientLight( 0xffffff, 0.25 );
    this.camera.add(ambient);

    var mat = new THREE.MeshLambertMaterial({
        color: 0xff0000,
    });
    var outerMat = new THREE.MeshLambertMaterial({
        color: 0x0000ff,
    });
    var angle1Mat = new THREE.MeshLambertMaterial({
        color: 0x00ff00,
    });
    var angle2Mat = new THREE.MeshLambertMaterial({
        color: 0xffff00,
    });
    var debugMat = new THREE.MeshLambertMaterial({
        color: 0xff00fff,
    });
    var tubeMat = new THREE.MeshLambertMaterial({
        color: 0x000000,
        wireframe: true
    });
    this.curveMat = tubeMat;
    var planeMat = new THREE.MeshLambertMaterial({
        color: 0x666666,
        side: THREE.DoubleSide,
        opacity: 0.75,
        transparent: true
    });

    var count = 15;
    var positions = [];
    for (var i = 0; i < count; i++) {
        var a = (i / count) * Math.PI * 2;
        a += ((Math.PI * 2) / count) / 2;
        var position = this.trefoil(a);
        position.multiplyScalar(1/3);
        positions.push(position);
    }

    var beadRadius = .3;
    this.beadRadius = beadRadius;

    var bodies = positions.map(function(position, i) {
        var shape = new CANNON.Sphere(beadRadius);
        var body = new CANNON.Body({
            mass: 1,
            position: new CANNON.Vec3().copy(position)
        });
        body.addShape(shape);
        this.world.addBody(body);
        return body;
    }.bind(this));

    bodies.forEach(function(bodyA, i) {
        var j = (i + 1) % bodies.length;
        var bodyB = bodies[j];
        var constraint = new CANNON.DistanceConstraint(
            bodyA,
            bodyB,
            beadRadius * 1.7
        );
        constraint.collideConnected = false;
        this.world.addConstraint(constraint);
    }.bind(this));

    var sphereGeom = new THREE.SphereGeometry(beadRadius * .8, 10, 10);
    this.outerSpheres = [];
    this.angle1Spheres = [];
    this.angle2Spheres = [];
    this.spheres = bodies.map(function(bodies, i) {
        var outer = i % (count / 3) == 2;
        var angle1 =  i == 0 || i == 4;
        var angle2 =  i == 10 || i == 14;

        var material = outer ? outerMat : mat;
        material = angle1 ? angle1Mat : material;
        material = angle2 ? angle2Mat : material;

        material = mat;
        if ([14,0,1,  5,6,7,8,9,10].indexOf(i) !== -1) {
            material = angle1Mat;
        }

        var sphere = new THREE.Mesh(sphereGeom, material);
        sphere.body = bodies;
        this.group.add(sphere);
        if (outer) {
            this.outerSpheres.push(sphere);
        }
        if (angle1) {
            this.angle1Spheres.push(sphere);
        }
        if (angle2) {
            this.angle2Spheres.push(sphere);
        }
        return sphere;
    }.bind(this));

    var tubeGeom = new THREE.CylinderGeometry(.01,.01,1);
    tubeGeom.rotateX(Math.PI / 2);

    this.tubes = this.spheres.map(function(sphere, i) {
        var j = (i + 1) % this.spheres.length;
        var nextSphere = this.spheres[j];
        var tube = new THREE.Mesh(tubeGeom, tubeMat);
        tube.sphereA = sphere;
        tube.sphereB = nextSphere;
        // this.group.add(tube);
        return tube;
    }.bind(this));

    this.curvePath = new THREE.CurvePath();

    this.curves = this.spheres.map(function(sphere, i) {
        var curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3()
        );
        curve.sphere = sphere;
        curve.lastSphere = this.spheres[this.mod(i - 1, this.spheres.length)];
        curve.nextSphere = this.spheres[this.mod(i + 1, this.spheres.length)];
        this.curvePath.add(curve);
        return curve;
    }.bind(this));

    var planeGeom = new THREE.PlaneGeometry(2, 2, 5, 5);

    var groundPlane = new THREE.Mesh(planeGeom, planeMat);
    var angle1Plane = new THREE.Mesh(planeGeom, planeMat);
    var angle2Plane = new THREE.Mesh(planeGeom, planeMat);
    var angle3Plane = new THREE.Mesh(planeGeom, planeMat);

    var ang = (Math.PI * 2) / 3;
    var off = 0.;
    // var off = .7;
    // var off = 1.3; 7
    var off = -.4;7


    angle1Plane.rotateZ(ang * 1 + off);
    angle1Plane.translateX(1);
    angle1Plane.rotateX(Math.PI * .5);

    angle2Plane.rotateZ(ang * 2 + off);
    angle2Plane.translateX(1);
    angle2Plane.rotateX(Math.PI * .5);

    angle3Plane.rotateZ(ang * 3 + off);
    angle3Plane.translateX(1);
    angle3Plane.rotateX(Math.PI * .5);

    this.group.add(groundPlane);
    this.group.add(angle1Plane);
    this.group.add(angle2Plane);
    this.group.add(angle3Plane);

    var m = new THREE.Mesh(
        new THREE.SphereGeometry(.05),
        new THREE.MeshLambertMaterial()
    );
    m.position.x = Math.sin((Math.PI / 6) * -5);
    m.position.y = Math.cos((Math.PI / 6) * -5);
    m.position.z = .3;

    var v = new THREE.Vector3(
        Math.sin(ang),
        Math.cos(ang),
        0
    );
    this.scene.add(new THREE.ArrowHelper(
        v,
        new THREE.Vector3(),
        .5,
        0xff0000
    ));

    // m.position = m.position.reflect(v);

    this.scene.add(m);
};

Main.prototype.orient = function(p, angle) {

    var v = new THREE.Vector2(p.x, p.y);
    var len = v.length();

    p.x = Math.sin(angle) * len;
    p.y = Math.cos(angle) * len;
    // v.x

    // var angle = v.angle();

    // // console.log(p.y, p.x, 'k', angle);

    // delta = this.mod(
    //     targetAngle - angle + (Math.PI * 3),
    //     Math.PI * 2
    // ) - Math.PI;

    // console.log(p.x, p.y, delta);

    // var cs = Math.cos(-delta);
    // var sn = Math.sin(-delta);

    // var px = p.x * cs - p.y * sn;
    // var py = p.x * sn + p.y * cs;

    // p.x = px;
    // p.y = py;

    // return p;
};

Main.prototype.mirror = function(v, normal) {
    return v.clone().sub(
        normal.clone().multiplyScalar(
            2 * v.dot(normal)
        ) 
    );
};

Main.prototype.update = function() {

    var TAU = Math.PI * 2;
    var a = (Math.PI / 6);

    var rotAndPlaneGroups = [
        [0, 5, 10],
        [1, 6, 11],
        [2, 7, 12],
        [3, 8, 13],
        [4, 9, 14]
    ];

    var mirrorGroups = [
        {
            normal: new THREE.Vector3(-1,0,0),
            pairs: [
                [0, 14],
                [1, 13],
                [2, 12],
                [3, 11],
                [4, 10],
                [5, 9],
                [6, 8],
            ]
        },
        {
            normal: new THREE.Vector3(
                Math.sin(a * 5),
                Math.cos(a * 5),
                0
            ),
            pairs: [
                [3, 1],
                [4, 0],
                [5, 14],
                [6, 13],
                [7, 12],
                [8, 11],
                [9, 10]
            ]
        },
        {
            normal: new THREE.Vector3(
                Math.sin(a * -5),
                Math.cos(a * -5),
                0
            ),
            pairs: [
                [5, 4],
                [6, 3],
                [7, 2],
                [8, 1],
                [9, 0],
                [10, 14],
                [11, 13]
            ]
        }
    ];

    rotAndPlaneGroups.forEach(function(group) {
        var rot = Math.PI * 2 / 3;
        var a = this.spheres[group[0]].body.position;
        var b = this.spheres[group[1]].body.position;
        var c = this.spheres[group[2]].body.position;
        var angle = new THREE.Vector2(c.y, c.x).angle();
        this.orient(a, angle + rot);
        this.orient(b, angle - rot);
        a.z = c.z;
        b.z = c.z;
    }.bind(this));

    mirrorGroups.forEach(function(group) {
        group.pairs.forEach(function(pair) {
            var a = this.spheres[pair[0]].body.position;
            var b = this.spheres[pair[1]].body.position;
            var v = new THREE.Vector3().copy(b);
            v.reflect(group.normal);
            a.x = v.x;
            a.y = v.y;
            a.z = -b.z;
        }.bind(this));
    }.bind(this));

    // this.orient(this.spheres[9].body.position, TAU / 4);
    // this.orient(this.spheres[5].body.position, TAU / -4);


    // this.orient(this.spheres[10].body.position, a * 1);
    // this.orient(this.spheres[14].body.position, a * -5);

    // this.orient(this.spheres[0].body.position, a * 5);
    // this.orient(this.spheres[4].body.position, a * -1);

    this.orient(this.spheres[2].body.position, a * 2);
    this.orient(this.spheres[7].body.position, a * 6);
    this.orient(this.spheres[12].body.position, a * -2);

//     this.orient(this.spheres[12].body.position, (Math.PI / 6) * -2);

// (Math.PI / 6) * 1 -.1

    this.outerSpheres.forEach(function(sphere) {
        sphere.body.position.z = 0;
    });

    this.spheres.forEach(function(sphere) {
        sphere.position.copy(sphere.body.position);
        sphere.quaternion.copy(sphere.body.quaternion);
    });

    this.tubes.forEach(function(tube) {
        var posA = tube.sphereA.position;
        var posB = tube.sphereB.position;
        var midpoint = posA.clone().lerp(posB, .5);
        tube.position.copy(midpoint);
        tube.lookAt(posA);
        tube.scale.setZ(posA.distanceTo(posB));
    });

    this.curves.forEach(function(curve) {
        var a = curve.lastSphere.position;
        var b = curve.sphere.position;
        var c = curve.nextSphere.position;

        a = a.clone().lerp(b, .5);
        c = c.clone().lerp(b, .5);

        curve.v0.copy(a);
        curve.v1.copy(b);
        curve.v2.copy(c);
    });

    if (this.curveMesh) {
        this.group.remove(this.curveMesh);
    }
    var curveGeom = new THREE.TubeBufferGeometry(
        this.curvePath,
        150,
        this.beadRadius * .9,
        20,
        true
    );
    this.curveMesh = new THREE.Mesh(curveGeom, this.curveMat );
    this.group.add(this.curveMesh);

    var plane = new THREE.Plane();

    plane.setFromCoplanarPoints(
        this.outerSpheres[0].position,
        this.outerSpheres[1].position,
        this.outerSpheres[2].position
    );
};

Main.prototype.initCanon = function() {
    this.world = new CANNON.World();
    this.world.gravity.set(0,0,0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;
};

Main.prototype.initThree = function() {
    var width = document.body.clientWidth;
    var height = document.body.clientHeight;

    this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    document.body.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(5, width / height, 0.1, 1000);
    this.camera.position.set(1, 1, -30);
    this.camera.up.set(0,1,0);

    this.cameraControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
};

Main.prototype.render = function() {
    this.cameraControls.update();
    this.renderer.render(this.scene, this.camera);
};

Main.prototype.isStatic = function(lastPos, pos) {
    var diff = 0;
    diff += Math.abs(pos.x - lastPos.x);
    diff += Math.abs(pos.y - lastPos.y);
    diff += Math.abs(pos.z - lastPos.z);
    return diff < 0.000001;
};

Main.prototype.animate = function() {
    requestAnimationFrame(this.animate.bind(this));

    var position = this.spheres[0].position.clone();
    var change = true;

    if (this.lastPosition) {
        change = ! this.isStatic(this.lastPosition, position);
    }

    this.lastPosition = position;

    if (change) {
        this.world.step(dt);
        this.update();
    }

    if ( ! change && ! this.done) {

        var frames = this.curvePath.computeFrenetFrames(30, true);

        var output = '';

        // this.curvePath.getSpacedPoints(30).forEach(function(point, i) {
        //     console.log(i);
        //     this.addFramesHelpers(point, frames, i);
        // }.bind(this));

        // this.curves.forEach(function(curve, i) {
        //     var a = curve.lastSphere.getWorldPosition();
        //     var b = curve.sphere.getWorldPosition();
        //     var c = curve.nextSphere.getWorldPosition();

        //     a = a.clone().lerp(b, .5);
        //     c = c.clone().lerp(b, .5);

        //     var m = new THREE.Mesh(
        //         new THREE.SphereGeometry(.05),
        //         new THREE.MeshLambertMaterial()
        //     );
        //     m.position.copy(a);
        //     this.scene.add(m);
        // }.bind(this));

        [14,0,1,  5,6,7,8,9,10].forEach(function(i, j) {

            var curve = this.curves[i];

            var a = curve.lastSphere.getWorldPosition();
            var b = curve.sphere.getWorldPosition();
            var c = curve.nextSphere.getWorldPosition();

            a = a.clone().lerp(b, .5);
            c = c.clone().lerp(b, .5);

            // var m = new THREE.Mesh(
            //     new THREE.SphereGeometry(.05),
            //     new THREE.MeshLambertMaterial()
            // );
            // m.position.copy(c);
            // this.scene.add(m);

            var z = new THREE.Vector3(0,0,1);

            // a.applyAxisAngle(z, -.4);
            // b.applyAxisAngle(z, -.4);
            // c.applyAxisAngle(z, -.4);

            // this.addFramesHelpers(c, frames, this.mod(i * 2 + 2, 30));

            var fiA = i * 2;
            var fiC = this.mod(i * 2 + 2, 30);

            var tangents = frames.tangents;
            var normals = frames.normals;
            var binormals = frames.binormals;

            a.multiplyScalar(1.4);
            b.multiplyScalar(1.4);
            c.multiplyScalar(1.4);

            output += '// ' + i + '\n';
            output += 'vec3 a' + j + ' = vec3(' + a.toArray().join(', ') + ');\n';
            output += 'vec3 b' + j + ' = vec3(' + b.toArray().join(', ') + ');\n';
            output += 'vec3 c' + j + ' = vec3(' + c.toArray().join(', ') + ');\n';
            output += 'vec3 aTan' + j + ' = vec3(' + tangents[fiA].toArray().join(', ') + ');\n';
            output += 'vec3 cTan' + j + ' = vec3(' + tangents[fiC].toArray().join(', ') + ');\n';
            output += 'vec3 aNor' + j + ' = vec3(' + normals[fiA].toArray().join(', ') + ');\n';
            output += 'vec3 cNor' + j + ' = vec3(' + normals[fiC].toArray().join(', ') + ');\n';

        }.bind(this));

        console.log(output);
        this.done = true;
    }

    this.render();
};

Main.prototype.addFramesHelpers = function(position, frames, i) {
    this.scene.add(new THREE.ArrowHelper(
        frames.normals[i],
        position,
        0.2,
        0xff0000
    ));
    this.scene.add(new THREE.ArrowHelper(
        frames.binormals[i],
        position,
        0.2,
        0x00ff00
    ));
    this.scene.add(new THREE.ArrowHelper(
        frames.tangents[i],
        position,
        0.2,
        0x0000ff
    ));
}

Main.prototype.setSize = function(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
};

Main.prototype.onResize = function() {
    var width = document.body.clientWidth;
    var height = document.body.clientHeight;
    this.setSize(width, height);
};

Main.prototype.mod = function(a, n) {
    return a - Math.floor(a / n) * n;
};

const main = new Main();
