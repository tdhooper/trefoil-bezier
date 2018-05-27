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
    return new THREE.Vector3(
        Math.sin(a) + 2 * Math.sin(2 * a),
        Math.cos(a) - 2 * Math.cos(2 * a),
        -Math.sin(3 * a)
    );
};

Main.prototype.initScene = function() {
    this.scene = new THREE.Scene();
    this.scene.add(this.camera);

    var light = new THREE.PointLight( 0xffffff, 2, 100 );
    light.position.set( -5, 5, 5 );
    this.camera.add(light);

    var ambient = new THREE.AmbientLight( 0xffffff, 0.25 );
    this.camera.add(ambient);

    var mat = new THREE.MeshLambertMaterial({
        color: 0xff0000,
        opacity: 0.25,
        transparent: true
    });
    var tubeMat = new THREE.MeshLambertMaterial({
        color: 0x666666
    });
    this.curveMat = tubeMat;

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
            beadRadius * 1.8
        );
        constraint.collideConnected = false;
        this.world.addConstraint(constraint);
    }.bind(this));

    var sphereGeom = new THREE.SphereGeometry(beadRadius,50,50);

    this.spheres = bodies.map(function(bodies, i) {
        var sphere = new THREE.Mesh(sphereGeom, mat);
        sphere.body = bodies;
        this.scene.add(sphere);
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
        // this.scene.add(tube);
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

    this.update();
};

Main.prototype.update = function() {

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
        this.scene.remove(this.curveMesh);
    }
    var curveGeom = new THREE.TubeBufferGeometry(this.curvePath, 150, this.beadRadius, 20, true);
    this.curveMesh = new THREE.Mesh(curveGeom, this.curveMat );
    this.scene.add(this.curveMesh);
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
    this.camera.position.set(0, 0, 30);
    this.camera.up.set(0,-1,0);

    this.cameraControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
};

Main.prototype.render = function() {
    this.cameraControls.update();
    this.renderer.render(this.scene, this.camera);
};

Main.prototype.animate = function() {
    requestAnimationFrame(this.animate.bind(this));

    this.world.step(dt);
    // var t = world.time;
    this.update();
    this.render();
};

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
