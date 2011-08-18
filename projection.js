function debug(str){
	document.getElementById("debug").innerHTML += str + "<br/>";
}

function toRadians(angle){
	return angle * Math.PI / 360;
}

/* Register Mouse Wheel */
if (window.addEventListener)
	window.addEventListener('DOMMouseScroll', wheel, false);
window.onmousewheel = document.onmousewheel = wheel;

/* wheel function */
function wheel(event){
	var delta = 0;
	if (!event) event = window.event;
	if (event.wheelDelta) {
		delta = event.wheelDelta/120;
		if (window.opera) delta = -delta;
	} else if (event.detail) {
		delta = -event.detail/3;
	}
	if (delta){
		if (delta < 0)
			window.pengine.zoom(-1);
		else
			window.pengine.zoom(1);
	}
	window.pengine.refresh();
}

function onMouseDown(e){
	this.down = true;
	this.sx = e.pageX;
	this.sy = e.pageY;
	this.pdx = 0;
	this.pdy = 0;
}

function onMouseMove(e){
	if(this.down){
		var dx = e.pageX-this.sx;
		var dy = e.pageY-this.sy;

		if (Math.abs(dx) < Math.abs(this.pdx)){
			this.sx = e.pageX;
			dx = 0;
		}
		if (Math.abs(dy) < Math.abs(this.pdy)){
			this.sy = e.pageY;
			dy = 0;
		}
		this.pdx = dx;
		this.pdy = dy;
		//rotate if left button is clicked
		//pan if middle button is clicked
		if (e.button == 0){
			window.pengine.rotate(0,0,toRadians(-dx/canvas.width * 15));
			window.pengine.rotate(toRadians(dy/canvas.height * 15),0,0);
		}else if (e.button == 1){
			canvas.style.cursor = "move";
			window.panX += dx/canvas.width * 30;
			window.panY += dy/canvas.height * 30;
		}

		window.pengine.refresh();
	}
}

function onMouseUp(){
	this.down = false;
	canvas.style.cursor = "crosshair";
}

function setPixelColor(imageData,x,y,color){
    var index = (x + y * imageData.width) * 4;
    imageData.data[index+0] = color.r;
    imageData.data[index+1] = color.g;
    imageData.data[index+2] = color.b;
    imageData.data[index+3] = color.a;
}

function PEngine(canvas){
	if (canvas.getContext){
		this.ctx = canvas.getContext("2d");
		this.canvas = canvas;
		//hardcoded parameters
		//frustum parameters
		this.l = -10;
		this.r = 10;
		this.b = -10;
		this.t = 10;
		this.n = -10;
		this.f = -20;
		this.nx = canvas.width;
		this.ny = canvas.height;

		//canvas setup
		canvas.onmouseup = onMouseUp;
		canvas.onmousedown = onMouseDown;
		canvas.onmousemove = onMouseMove;
		canvas.style.cursor = "crosshair";
		//global variables
		window.pengine = this;
		window.panX = 0;
		window.panY = 0;
		window.scaleFactor = 1;
		window.epsilon = 0.000001;

		//initial camera parameter
		this.pov= new Point(3,3,3);
		this.center = new Point(0,0,0);
		this.gv = this.center.subtract(this.pov);
		this.tv = new Point(0,0,1);

		this.triangles = makeTestTriangles();
		//init the tree
		this.tree = new Node(this.triangles[0]);
		for (var i=1;i<this.triangles.length;++i){
			this.tree.add(this.triangles[i]);
		}

		//will init the scene and refresh
		this.setPerspective(false);

	}else{
		alert("canvas is not supported");
	}
}

PEngine.prototype.init = function(){
		//init cam coordinates
		this.w = this.gv.divideScaler(this.gv.modulus()).multiplyScaler(-1);
		this.u = this.tv.cross(this.w).divideScaler(this.tv.cross(this.w).modulus());
		this.v = this.w.cross(this.u);

		with (this){
			//create mo (orthogonal projection matrix)
			var mCanonical = $M([
					[nx/2,0,0,(nx-1)/2],
					[0,-ny/2,0,(ny-1)/2],
					[0,0,1,0],
					[0,0,0,1]]
					);
			var mProjScale= $M([
					[2/(r-l),0,0,0],
					[0,2/(t-b),0,0],
					[0,0,2/(n-f),0],
					[0,0,0,1]]
					);
			var mProjTrans= $M([
					[1,0,0,-(l+r)/2],
					[0,1,0,-(b+t)/2],
					[0,0,1,-(n+f)/2],
					[0,0,0,1]]
					);
			var mo = (mCanonical.x(mProjScale)).x(mProjTrans);

			//compute mp (prespective projection matrix)
			var mp = $M([
					[n,0,0,0],
					[0,n,0,0],
					[0,0,n+f,-f*n],
					[0,0,1,0]]
					);

			//create mv (viewport matrix)
			var mCamRotate = $M([
					[u.x,u.y,u.z,0],
					[v.x,v.y,v.z,0],
					[w.x,w.y,w.z,0],
					[0,0,0,1]
					]);

			var mCamTrans= $M([
					[1,0,0,-pov.x],
					[0,1,0,-pov.y],
					[0,0,1,-pov.z],
					[0,0,0,1]
					]);
			var mv = mCamRotate.x(mCamTrans);

			/*this.m = mo.x(mv);*/
			if (this.perspective)
				this.m = mo.x(mp).x(mv);
			else
				this.m = mo.x(mv);

		}
}

PEngine.prototype.setPerspective = function(value){
	this.perspective = value;
	if (value){
		this.zoom = this.zoomPerspective;
		window.scaleFactor = 1;
	}
	else
		this.zoom = this.zoomOrthograthic;
	this.init();
	this.refresh();
}

PEngine.prototype.draw = function(shape){
	shape.draw(this.ctx,this.m);
}

PEngine.prototype.refresh = function(){
	//clear canvas
	this.ctx.clearRect(0,0,canvas.width,canvas.height);
	this.drawGrid();
	this.drawAxes();
	this.drawTree(this.tree,this.pov);
}

PEngine.prototype.rotate = function(xang,yang,zang){
	var zrot = $M([
			[Math.cos(zang),-Math.sin(zang),0,0],
			[Math.sin(zang),Math.cos(zang),0,0],
			[0,0,1,0],
			[0,0,0,1]
			]);
	var xrot = $M([
			[1,0,0,0],
			[0,Math.cos(xang),-Math.sin(xang),0],
			[0,Math.sin(xang),Math.cos(xang),0],
			[0,0,0,1],
			]);
	//TODO: add y axis rotation
	/*var yrot = $M([*/
	/*[Math.cos(yang),0,Math.sin(yang),0],*/
	/*[0,1,0,0],*/
	/*[-Math.sin(yang),0,Math.cos(yang),0],*/
	/*[0,0,0,1],*/
	/*]);*/
	var point = $M([[this.pov.x],[this.pov.y],[this.pov.z],[1]]);
	var projection = zrot.x(point);
	projection = xrot.x(projection);
	/*projection = yrot.x(projection);*/
	this.pov = new Point(projection.e(1,1),projection.e(2,1),projection.e(3,1));
	//adjust gaze vector and stand up vector
	this.gv = this.center.subtract(this.pov);
	//TODO : ask about this sign hack
	/*this.tv = new Point(0,0,this.pov.y/Math.abs(this.pov.y) * 3);*/
	this.tv = new Point(0,0,3);

	this.init();
	this.refresh();
}

PEngine.prototype.move = function(dx,dy,dz){
	var mdelta = $M([
			[1,0,0,dx],
			[0,1,0,dy],
			[0,0,1,dz],
			[0,0,0,1],
			]);
	this.m = this.m.x(mdelta);
}

/* zoom in or out according to the sign (+1,-1) by changing the pov location */
PEngine.prototype.zoomPerspective = function(sign){
	var v = this.center;
	v = v.subtract(this.pov);
	this.pov = this.pov.add(v.multiplyScaler(sign*0.1));
	this.init();
}

PEngine.prototype.zoomOrthograthic = function(sign){
	window.scaleFactor += sign * 0.1;
}

PEngine.prototype.drawAxes = function(){
	var org = new Point(0,0,0);
	var xaxis = new Line(org,new Point(7,0,0));
	var yaxis = new Line(org,new Point(0,7,0));
	var zaxis = new Line(org,new Point(0,0,7));
	xaxis.thickness = 1;
	xaxis.color = new RGB(255,0,0); //red
	yaxis.thickness = 1;
	yaxis.color = new RGB(0,255,0); //green
	zaxis.thickness = 1;
	zaxis.color = new RGB(0,0,255); //blue
	this.draw(xaxis);
	this.draw(yaxis);
	this.draw(zaxis);
}

PEngine.prototype.drawGrid = function(){
	var hlen = 5;
	for (var i=-5;i<=5;i++){
		var l = new Line(new Point(i,-hlen,0),new Point(i,hlen,0));
		var l2 = new Line(new Point(hlen,i,0),new Point(-hlen,i,0));
		l.color = new RGB(200,200,200); //gray
		l2.color = new RGB(200,200,200); //gray
		this.draw(l);
		this.draw(l2);
	}
}

PEngine.prototype.drawTree = function(tree,point){
	if (tree == null) return;
	if (tree.triangle.f(point) < 0){
		this.drawTree(tree.positive,point);
		this.draw(tree.triangle);
		this.drawTree(tree.negative,point);
	}else {
		this.drawTree(tree.negative,point);
		this.draw(tree.triangle);
		this.drawTree(tree.positive,point);
	}
}

PEngine.prototype.renderImage = function(){
	//nx and ny can be changed to change the scale of the final image

	var backgroundColor = new RGB(0,0,0); //black
	var imageData = this.ctx.createImageData(this.nx,this.ny);

	for (var i=0;i<this.nx;++i){
		for (var j=0;j<this.ny;++j){
			var hits = 0;
			var r=0,g=0,b=0;
			//supersampling
			for (var ix = i;ix<i+1;ix+=0.5){
				for (var jx = j;jx<j+1;jx+=0.5){

					var us = this.l + ((this.r-this.l) * (ix+0.5))/this.nx;
					var vs = this.b + ((this.t-this.b) * (this.ny-jx+0.5))/this.ny;
					var ws = this.n;

					var s = this.pov.add(this.u.multiplyScaler(us).add(this.v.multiplyScaler(vs)).add(this.w.multiplyScaler(ws)));

					var e;
					if (this.perspective)
						e = this.pov;
					else
						e = this.pov.add(this.u.multiplyScaler(us).add(this.v.multiplyScaler(vs)));

					var obj = this.raytrace(s,e);

					if (obj != null){
						hits++;
						r+= obj.color.r;
						g+= obj.color.g;
						b+= obj.color.b;
					}
				}
			}

			if (hits == 0)
				setPixelColor(imageData,i,j,backgroundColor);
			else{
				var c = new RGB(r/hits,g/hits,b/hits);
				setPixelColor(imageData,i,j,c);
			}

		}
	}
	this.ctx.putImageData(imageData, 0, 0);
}

PEngine.prototype.raytrace = function(s,e){
	var min = null;
	var mint = 100000000;
	for (var tri=0;tri<this.triangles.length;++tri){
		var o = this.triangles[tri];
		var t = - (o.normal.dot(e) - o.normal.dot(o.p1))/o.normal.dot(s.subtract(e));
		var A = e.add(s.subtract(e).multiplyScaler(t));
		if (t < 0) continue;
		if (t<mint && o.intersectsWithPoint(A)){
			mint = t;
			min = o;
		}
	}
	return min;
}

//-----------------------------------------------------
//Triangle Object
function Triangle (p1,p2,p3){
	this.p1 = p1;
	this.p2 = p2;
	this.p3 = p3;
	this.color = new RGB(0,0,0); //black
	//storing plane normal for efficiency
	this.calculateNormal();
}

Triangle.prototype.calculateNormal = function(){
	var v1 = this.p2.subtract(this.p1);
	var v2 = this.p3.subtract(this.p1);
	this.normal = v1.cross(v2);
	this.normal = this.normal.divideScaler(this.normal.modulus());
}

Triangle.prototype.inspect = function(){
	return "p1 : " + this.p1.inspect() + "\np2: " + this.p2.inspect() + "\np3: " + this.p3.inspect();
}

Triangle.prototype.clone = function(){
	var t = new Triangle(this.p1.clone(),this.p2.clone(),this.p3.clone());
	t.color = this.color.clone();
	t.normal = this.normal;
	return t;
}

Triangle.prototype.draw = function(ctx,matrix){
	ctx.fillStyle = this.color.str();
	ctx.beginPath();
	var pp1 = this.p1.projection(matrix);
	var pp2 = this.p2.projection(matrix);
	var pp3 = this.p3.projection(matrix);
	ctx.moveTo(pp1.x,pp1.y);
	ctx.lineTo(pp2.x,pp2.y);
	ctx.lineTo(pp3.x,pp3.y);
	ctx.lineTo(pp1.x,pp1.y);
	ctx.fillStyle = this.color.str();
	ctx.fill();
}

Triangle.prototype.f = function(point){
	return this.normal.dot(point.subtract(this.p1));
}

/* tests if given point intersects this triangle */
Triangle.prototype.intersectsWithPoint = function(point){
	//TODO: the function will be used by raytracing , so the points
	//given will already be in the plane of the triangle
	//so first check can be removed for efficency
	//first check that the point belongs to the same plane as the triangle
	if (Math.abs(this.normal.dot(point) - this.normal.dot(this.p1)) > window.epsilon)
		return false;
	//second make sure point belongs to the triangle
	var pts = [this.p1,this.p2,this.p3,this.p1,this.p2];
	for (var i=0;i<3;++i){
		var a = pts[i];
		var b = pts[i+1];
		var c = pts[i+2];
		var v1 = b.subtract(a);
		var v2 = point.subtract(a);
		var v3 = c.subtract(a);
		var res = v1.cross(v2).dot(v1.cross(v3));
		if (Math.abs(res) < window.epsilon) res = 0;
		if (res < 0)
			return false;
	}
	return true;
}
//-----------------------------------------------------
//Line Object
function Line (start,end){
	this.start = start;
	this.end = end;
	this.color = new RGB(0,0,0);
	this.thickness = 1;
}

Line.prototype.inspect = function(){
	return "start : " + this.start.inspect() + "\nend : " + this.end.inspect();
}

Line.prototype.draw = function(ctx,matrix){
	ctx.strokeStyle = this.color.str();
	ctx.lineWidth = this.thickness;
	ctx.beginPath();
	var sp = this.start.projection(matrix);
	var ep = this.end.projection(matrix);
	ctx.moveTo(sp.x,sp.y);
	ctx.lineTo(ep.x,ep.y);
	ctx.stroke();
}

//-----------------------------------------------------
//Point Object
function Point(x,y,z){
	this.x = x;
	this.y = y;
	this.z = z;
	this.h = 1;
	this.thickness = 1;
	this.color = new RGB(0,0,0);
}

Point.prototype.clone = function(){
	var p = new Point(this.x,this.y,this.z);
	p.color = this.color.clone();
	p.thickness = this.thickness;
	return p;
}

Point.prototype.modulus = function(){
	return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
}

Point.prototype.dot = function(point){
	return this.x*point.x + this.y*point.y + this.z*point.z;
}

Point.prototype.cross = function(point){
	return new Point(this.y*point.z - this.z*point.y,this.z*point.x - this.x*point.z,this.x*point.y - this.y*point.x);
}
Point.prototype.divideScaler = function(mag){
	if (mag == 0) return null;
	return new Point(this.x/mag,this.y/mag,this.z/mag);
}

Point.prototype.multiplyScaler= function(mag){
	return new Point(this.x*mag,this.y*mag,this.z*mag);
}

Point.prototype.subtract = function(point){
	return new Point(this.x-point.x,this.y-point.y,this.z-point.z);
}

Point.prototype.add= function(point){
	return new Point(this.x+point.x,this.y+point.y,this.z+point.z);
}

Point.prototype.inspect = function(){
	return "( " + this.x + " , " + this.y + " , " + this.z + " )";
}

Point.prototype.draw = function(ctx,matrix){
		var p = this.projection(matrix);
		ctx.fillStyle = this.color.str();
		ctx.fillRect(p.x,p.y,this.thickness,this.thickness);
}

Point.prototype.projection = function(matrix){
	var point = $M([[this.x *window.scaleFactor],[this.y * window.scaleFactor],[this.z * window.scaleFactor],[1]]);
	var projection = matrix.x(point);
	return new Point(projection.e(1,1)/projection.e(4,1) + window.panX,projection.e(2,1)/projection.e(4,1) + window.panY,0);
}

//-----------------------------------------------------
//RGB Object
function RGB(r,g,b){
	this.r = r;
	this.g = g;
	this.b = b;
	this.a = 0xff; // opaque
}

RGB.prototype.str = function(){
	return "rgb("+ this.r +","+ this.g +","+ this.b +")";
}

RGB.prototype.clone = function(){
	return new RGB(this.r,this.g,this.b);
}

//-----------------------------------------------------
//Node Object
function Node(triangle){
	this.triangle = triangle;
	this.negative = null;
	this.positive = null;
}

Node.prototype.add = function(triangle){

	var fa = this.triangle.f(triangle.p1);
	var fb = this.triangle.f(triangle.p2);
	var fc = this.triangle.f(triangle.p3);
	if (Math.abs(fa) <= window.epsilon) fa = 0;
	if (Math.abs(fb) <= window.epsilon) fb = 0;
	if (Math.abs(fc) <= window.epsilon) fc = 0;

	if (fa <= 0 && fb <= 0 && fc <= 0){
		this.addNegativeNode(triangle);
	}else if (fa >= 0 && fb >= 0 && fc >= 0){
		this.addPositiveNode(triangle);
	}else{
		var tmp;
		//swap the points such that p3 is on one side
		//and p1,p2 are on the other side of the plane
		if (fa * fc >= 0){
			tmp = fb;fb = fa;fa = fc;fc = tmp;
			tmp = triangle.p2; triangle.p2 = triangle.p1; triangle.p1= triangle.p3;triangle.p3 = tmp;
		}else if (fb * fc >= 0){
			tmp = fa;fa= fb; fb = fc; fc = tmp;
			tmp = triangle.p1; triangle.p1 = triangle.p2; triangle.p2 = triangle.p3; triangle.p3 = tmp;
		}
		//calculate the first point of intersection A
		var n = this.triangle.normal;

		var d = - this.triangle.normal.dot(this.triangle.p1);
		var t = - (n.dot(triangle.p1) + d)/(n.dot(triangle.p3.subtract(triangle.p1)));
		var A = triangle.p1.add(triangle.p3.subtract(triangle.p1).multiplyScaler(t));
		//calculate the second point of intersection B
		t = - (n.dot(triangle.p2) + d)/(n.dot(triangle.p3.subtract(triangle.p2)));
		var B = triangle.p2.add(triangle.p3.subtract(triangle.p2).multiplyScaler(t));
		//create the three Triangles
		//also calculate their normals
		var t1 = triangle.clone();
		t1.p1 = triangle.p1.clone();t1.p2 = triangle.p2.clone(); t1.p3 = A.clone();
		t1.calculateNormal();
		var t2 = triangle.clone();
		t2.p1 = triangle.p2.clone();t2.p2 = B.clone(); t2.p3 = A.clone();
		t2.calculateNormal();
		var t3 = triangle.clone();
		t3.p1 = A.clone();t3.p2 = B.clone(); t3.p3 = triangle.p3.clone();
		t3.calculateNormal();
		if (fc >= 0){
			if (fa != 0)
				this.addNegativeNode(t1);
			if (fb != 0)
				this.addNegativeNode(t2);
			if (fc != 0)
				this.addPositiveNode(t3);
		}else{
			if (fa != 0)
				this.addPositiveNode(t1);
			if (fb != 0)
				this.addPositiveNode(t2);
			if (fc != 0)
				this.addNegativeNode(t3);
		}
	}
}

/* helper method */
Node.prototype.addPositiveNode = function(triangle){
	if (this.positive == null)
		this.positive = new Node(triangle);
	else
		this.positive.add(triangle);
}

/* helper method */
Node.prototype.addNegativeNode = function(triangle){
	if (this.negative == null)
		this.negative = new Node(triangle);
	else
		this.negative.add(triangle);
}
//-----------------------------------------------------
// Testing code
function demo(){
	window.pengine.rotate(0,0,toRadians(5));
	/*window.pengine.refresh();*/

	/*var lines=[0,0,0,1,0,0,0,1,0,1,1,0,0,0,0,0,0,4,0,1,0,0,1,4,0,0,4,1,0,4,0,1,4,1,1,4,1,0,0,1,0,1,1,1,0,1,1,1,1,0,1,1.5,0,1,1,1,1,1.5,1,1,1.5,0,1,*/
	/*2,0,0,1.5,1,1,2,1,0,2,0,0,3,0,0,2,1,0,3,1,0,1,0,4,1,0,3,1,1,4,1,1,3,1,0,3,1.5,0,3,1,1,3,1.5,1,3,1.5,0,3,2,0,4,1.5,1,3,2,1,4,2,0,4,3,*/
	/*0,4,2,1,4,3,1,4,3,0,4,2,0,2,3,1,4,2,1,2,2,0,2,3,0,0,2,1,2,3,1,0,0,0,4,0,1,4,1,0,4,1,1,4,2,0,4,2,1,4,3,0,4,3,1,4,1,0,3,1,1,3,1.5,0,3,1.5,1,3,*/
	/*0,0,0,0,1,0,1,0,0,1,1,0,1,0,1,1,1,1,1.5,0,1,1.5,1,1,2,0,0,2,1,0,3,0,0,3,1,0,2,0,2,2,1,2];*/
	/*k(new Point(-5,1,0),lines);*/
	/*lines = [0,0,0,0,0,4,0,0,0,3,0,0,0,0,4,3,0,4,3,0,4,3,0,0,1,0,1,1,0,3,1,0,1,2,0,1,1,0,3,2,0,3,2,0,3,2,0,1,*/
	/*0,1,0,0,1,4,0,1,0,3,1,0,0,1,4,3,1,4,3,1,4,3,1,0,1,1,1,1,1,3,1,1,1,2,1,1,1,1,3,2,1,3,2,1,3,2,1,1,*/
	/*0,0,0,0,1,0,3,0,0,3,1,0,0,0,4,0,1,4,3,0,4,3,1,4,1,0,1,1,1,1,2,0,1,2,1,1,1,0,3,1,1,3,2,0,3,2,1,3*/
	/*];*/
	/*k(new Point(-1,1,0),lines);*/
	/*lines = [1,0,0,2,0,0,1,0,0,1,0,3,2,0,0,2,0,3,1,0,3,0,0,3,0,0,3,0,0,4,0,0,4,3,0,4,3,0,4,3,0,3,3,0,3,2,0,3,*/
	/*1,1,0,2,1,0,1,1,0,1,1,3,2,1,0,2,1,3,1,1,3,0,1,3,0,1,3,0,1,4,0,1,4,3,1,4,3,1,4,3,1,3,3,1,3,2,1,3,*/
	/*1,0,0,1,1,0,2,0,0,2,1,0,0,0,3,0,1,3,0,0,4,0,1,4,1,0,3,1,1,3,2,0,3,2,1,3,3,0,3,3,1,3,3,0,4,3,1,4*/
	/*];*/
	/*k(new Point(3,1,0),lines);*/
}

function k(base,lines){
	for (var i=0;i<lines.length;i+=6){
		var l = new Line(new Point(base.x + lines[i],base.y + lines[i+1],base.z + lines[i+2]) ,
				new Point(base.x + lines[i+3] , base.y + lines[i+4] , base.z + lines[i+5]));
		window.pengine.draw(l);
	}
}

function makeTestTriangles(){

	var c = new RGB(255,177,0);
	var f1a = new Triangle(new Point(0,0,0),new Point(1,0,1),new Point(0,0,1));
	f1a.color = c;
	var f1b = new Triangle(new Point(0,0,0),new Point(1,0,0),new Point(1,0,1));
	f1b.color = c;

	c = new RGB(0,0,255);
	var f2a = new Triangle(new Point(0,1,0),new Point(1,1,1),new Point(0,1,1));
	var f2b = new Triangle(new Point(0,1,0),new Point(1,1,0),new Point(1,1,1));
	f2a.color = c;
	f2b.color = c;

	c = new RGB(255,0,0);
	var f3a = new Triangle(new Point(1,0,0),new Point(1,0,1),new Point(1,1,1));
	f3a.color = c;
	var f3b = new Triangle(new Point(1,0,0),new Point(1,1,0),new Point(1,1,1));
	f3b.color = c;

	c = new RGB(0,255,0);
	var f4a = new Triangle(new Point(0,0,0),new Point(0,0,1),new Point(0,1,1));
	var f4b = new Triangle(new Point(0,0,0),new Point(0,1,0),new Point(0,1,1));
	f4a.color = c;
	f4b.color = c;

	c = new RGB(255,255,0);
	var f5a = new Triangle(new Point(0,0,1),new Point(0,1,1),new Point(1,1,1));
	var f5b = new Triangle(new Point(0,0,1),new Point(1,0,1),new Point(1,1,1));
	f5a.color = c;
	f5b.color = c;

	c = new RGB(200,200,200);
	var f6a = new Triangle(new Point(3,-3,0),new Point(3,3,0),new Point(-3,3,0));
	var f6b = new Triangle(new Point(3,-3,0),new Point(-3,3,0),new Point(-3,-3,0));
	f6a.color = c;
	f6b.color = c;

	var trs = [f1a,f1b,f2a,f2b,f3a,f3b,f4a,f4b,f5a,f5b,f6a,f6b];

	return trs;
	/*var t1 = new Triangle(new Point(0,-1,0.5),new Point(1,0,0.5),new Point(0,1,0.5));*/
	/*t1.color = "lightblue";*/
	/*var t2 = new Triangle(new Point(0,0,0),new Point(1,0,0),new Point(0,0,1));*/
	/*t2.color = "yellow";*/
	/*var t3 = new Triangle(new Point(5,-5,0),new Point(5,5,0),new Point(-5,5,0));*/
	/*t3.color = "lightgray";*/
	/*var t4 = new Triangle(new Point(5,-5,0),new Point(-5,5,0),new Point(-5,-5,0));*/
	/*t4.color = "lightgray";*/
	/*var trs = [t1,t2,t3,t4];*/
}

function makeTestTree(){

	root = new Node(f1a);
	root.add(f1b);
	root.add(f2a);root.add(f2b);
	root.add(f3a);root.add(f3b);
	root.add(f4a);root.add(f4b);
	root.add(f5a);root.add(f5b);

	/*var t1 = new Triangle(new Point(0,-1,0.5),new Point(1,0,0.5),new Point(0,1,0.5));*/
	/*t1.color = "lightblue";*/
	/*var t2 = new Triangle(new Point(0,0,0),new Point(1,0,0),new Point(0,0,1));*/
	/*t2.color = "yellow";*/
	/*root = new Node (t2);*/
	/*var t3 = new Triangle(new Point(5,-5,0),new Point(5,5,0),new Point(-5,5,0));*/
	/*t3.color = "lightgray";*/
	/*var t4 = new Triangle(new Point(5,-5,0),new Point(-5,5,0),new Point(-5,-5,0));*/
	/*t4.color = "lightgray";*/
	/*root.add(t1);*/
	/*root.add(t3);*/
	/*root.add(t4);*/

	return root;
}

