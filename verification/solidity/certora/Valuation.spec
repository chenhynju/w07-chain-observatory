methods {
    function mark(uint112,uint112,uint112,uint112) external returns (bool,uint256) envfree;
}
rule zeroDenominator(uint112 a, uint112 b, uint112 r0) {
    bool valid; uint256 value;
    valid, value = mark(a, b, r0, 0);
    assert !valid && value == 0;
}
